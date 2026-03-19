from __future__ import annotations
from typing import List, Dict
from google.cloud import spanner
from decimal import Decimal
import uuid

def update_cart(database, session_id: str, cart_items: list) -> bool:
    """
    Updates the ActiveCart JSON column in UserSessions.
    """
    import json
    # Type JSON support layout ensures dictionary mapping
    query = """
        UPDATE UserSessions 
        SET ActiveCart = @cart, LastEvent = PENDING_COMMIT_TIMESTAMP() 
        WHERE SessionId = @sess_id
    """
    
    params = {
        "cart": cart_items, # List/Dict goes direct with spanner.param_types.JSON
        "sess_id": session_id
    }
    
    param_types = {
        "cart": spanner.param_types.JSON,
        "sess_id": spanner.param_types.STRING
    }
    
    try:
        # execute_update requires transaction layout layout layout
        def update_cart_tx(transaction):
            print(f"Executing Update Cart DML for session: {session_id}")
            transaction.execute_update(query, params=params, param_types=param_types)
            
        database.run_in_transaction(update_cart_tx)
        return True
    except Exception as e:
        print(f"Update Cart failed: {e}")
        return False

def place_order(database, customer_id: str, store_id: str, session_id: str, items: List[Dict]) -> str:
    """
    Places an order: Inserts into Orders, OrderItems, Payments and updates UserSessions atomically.
    Items format: [{"ProductId": "...", "Quantity": 2, "Price": 15.99}]
    """
    order_id = str(uuid.uuid4())
    payment_id = str(uuid.uuid4())
    total_amount = sum(Decimal(str(item["Price"])) * item["Quantity"] for item in items)
    
    def insert_order_tx(transaction):
        print(f"Creating Order {order_id} for Customer {customer_id}")
        
        # 1. Insert into Orders (interleaved in Customers)
        # Assuming CustomerId exists
        transaction.execute_update(
            """INSERT INTO Orders (CustomerId, OrderId, StoreId, TotalAmount, Status, OrderDate)
               VALUES (@customer_id, @order_id, @store_id, @total_amount, 'COMPLETED', PENDING_COMMIT_TIMESTAMP())""",
            params={
                "customer_id": customer_id,
                "order_id": order_id,
                "store_id": store_id,
                "total_amount": total_amount
            },
            param_types={
                "total_amount": spanner.param_types.NUMERIC
            }
        )
        
        # 2. Insert into OrderItems (interleaved in Orders)
        for index, item in enumerate(items):
            transaction.execute_update(
                """INSERT INTO OrderItems (CustomerId, OrderId, LineItemId, ProductId, Quantity, Price)
                   VALUES (@customer_id, @order_id, @line, @product_id, @qty, @price)""",
                params={
                    "customer_id": customer_id,
                    "order_id": order_id,
                    "line": index + 1,
                    "product_id": item["ProductId"],
                    "qty": item["Quantity"],
                    "price": Decimal(str(item["Price"]))
                },
                param_types={
                    "qty": spanner.param_types.INT64,
                    "price": spanner.param_types.NUMERIC
                }
            )

        # 3. Insert into Payments
        transaction.execute_update(
            """INSERT INTO Payments (PaymentId, SessionId, CustomerId, Amount, PaymentMethodToken, Status, CreatedAt)
               VALUES (@payment_id, @session_id, @customer_id, @amount, 'tok_visa_demo', 'SUCCESS', PENDING_COMMIT_TIMESTAMP())""",
            params={
                "payment_id": payment_id,
                "session_id": session_id,
                "customer_id": customer_id,
                "amount": total_amount
            },
            param_types={
                "amount": spanner.param_types.NUMERIC
            }
        )

        # 4. Update UserSessions (clear ActiveCart)
        transaction.execute_update(
            """UPDATE UserSessions 
               SET ActiveCart = NULL, LastEvent = PENDING_COMMIT_TIMESTAMP() 
               WHERE SessionId = @session_id""",
            params={
                "session_id": session_id
            }
        )
            
    try:
        database.run_in_transaction(insert_order_tx)
        return order_id
    except Exception as e:
        print(f"Place Order failed: {e}")
        return ""
