
with open('backend/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i in range(1650, 1670):
        if i < len(lines):
            print(f"{i+1}: {repr(lines[i])}")
