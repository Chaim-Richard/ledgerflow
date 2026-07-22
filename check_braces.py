with open('server.ts', 'r') as f:
    text = f.read()

opened = 0
for i, c in enumerate(text):
    if c == '{': opened += 1
    elif c == '}': opened -= 1

print("Brace balance:", opened)
