from config_store import discover_models
models = discover_models()
for m in models:
    fam = m["id"]
    real = m["real_id"]
    ctx = m["context_window"]
    vers = len(m["available_versions"])
    print(f"{fam:20s} -> {real:35s} | ctx: {ctx:5s} | versions: {vers}")
