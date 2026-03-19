from google.cloud import spanner
client = spanner.Client()
instance = client.instance('live-retail-geo')
db = instance.database('spanner-demo-db')
for m in dir(db):
    if 'update' in m.lower() or 'partition' in m.lower():
         print(m)
