import os

def fix_content(content):
    # Mapping of mangled characters (Commonly seen in the workspace)
    # The left side is what appears when UTF-8 bytes are read as CP437 and re-saved as UTF-8
    replacements = {
        "á": "á",
        "ç": "ç",
        "ã": "ã",
        "ú": "ú",
        "ó": "ó",
        "í": "í",
        "é": "é",
        "ê": "ê",
        "ô": "ô",
        "à": "à",
        "â": "â",
        "Ôö£í": "á", # Double mangled 'á'
        "ô": "ô",
        "ú": "ú",
        "û": "û",
        "⚠️": "⚠️",  # Emoji corruption
        "✅": "✅",
        "ℹ️": "ℹ️",
        "🔄": "🔄",
        "🔍": "🔍",
        "🚀": "🚀",
        "🧠": "🧠",
        "🛑": "🛑",
        "🚫": "🚫",
        "💰": "💰",
        "🗣️": "🗣️",
        "🔒": "🔒",
        "🚨": "🚨",
        "😊": "😊",
        "🔥": "🔥",
        "📊": "📊",
        "📅": "📅",
        "✂️": "✂️",
        "é": "é"
    }
    
    for old, new in replacements.items():
        content = content.replace(old, new)
    return content

def fix_files():
    backend_dir = "."
    for root, dirs, files in os.walk(backend_dir):
        if "venv" in root or "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    fixed_content_str = fix_content(content)
                    
                    if fixed_content_str != content:
                        print(f"Fixing {path}...")
                        with open(path, "w", encoding="utf-8") as f:
                            f.write(fixed_content_str)
                except Exception as e:
                    print(f"Error processing {path}: {e}")

if __name__ == "__main__":
    fix_files()
