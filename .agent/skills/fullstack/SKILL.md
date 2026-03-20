---
name: fullstack
description: >
  Guidelines for understanding and extending the React-FastAPI fullstack architecture,
  focusing on dev-time proxying, production single-page application (SPA) bundling, 
  and thin-route API bundling.
---

# Fullstack Architecture (React + FastAPI)

A guide for navigating the bridge between the **Vite-powered React frontend** and the **FastAPI Python backend**.

---

## 🏎️ Development-time Communication (Proxying)

During local development, the Frontend and Backend run as separate servers. 
Generally:
*   Frontend runs with **Vite** (e.g., ports 5173 or default allocations)
*   Backend runs with **Uvicorn** (e.g., port 8000)

### 🔌 Vite Proxy Setup
To avoid **CORS** restrictions during development, Vite relies on a **reverse-proxy layer** configured inside `vite.config.ts`. Any requests hitting mapped prefixes are forwarded natively down to the Python streams.

```typescript
// Example from frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
```

---

## 🚢 Production Bundling (SPA Setup)

In production sets (such as Cloud Run Docker builds), the application collapses into a **single running process**. The FastAPI server is responsible for serving both dynamic JSON APIs and static React assets.

### 🍱 FastAPI Mount sequence

1.  **Direct APIs**: Handled normally via `app.include_router()`.
2.  **Asset mount**: Standard bundles (`.css`, `.js` files in `dist/assets` or `static/assets`) mapped using `app.mount("/assets", StaticFiles(...))`.
3.  **Fallback SPA Catcher**: To support client-side routing solvers (like React Router), any route hitting paths that *don't* start with `/api` fall back into streaming the static `index.html` payload.

```python
# Example fallback matcher in backend/svc/main.py
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api"):
         raise HTTPException(status_code=404)
    
    index_file = os.path.join(static_dir, "index.html")
    return HTMLResponse(content=open(index_file).read())
```

---

## 🧩 Thin Routings Pattern

API controllers maintain cleanly separated divisional flows before surfacing forwards.

1.  **Features Scope**: Business logic or Vertex AI generations sit inside modular feature packs (`svc/apis/storefront/router.py`, `svc/apis/security/router.py`).
2.  **Global Aggregator**: All routers gathered inside `svc/routes/views.py` using `.include_router()` directives allocating uniform prefixes (`/api/storefront`, `/api/security`).

---

## 🚨 Gotchas to Avoid

*   **Prefix Exclusivity**: Since the Single Page Application fallback catch-all maps directly to `/{full_path:path}`, ensure all custom API layers start with **strictly demarcated prefixes** (typically `/api/`) to avoid accidental route collisions with client-side routes (e.g. `/admin`).
*   **Static folder reference**: Production builders look heavily forwards to bundled file drops from distinct modules. Always ensure `dist/` or `static/` paths calculated are relative accurately (`os.path.dirname(__file__)`).
