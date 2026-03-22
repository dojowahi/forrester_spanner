from google.cloud import spanner
print("Spanner Param Types:")
for item in dir(spanner.param_types):
    if not item.startswith("__"):
        print(item)
