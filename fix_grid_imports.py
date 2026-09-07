import re

with open('src/components/ledger/TransactionGrid.tsx', 'r') as f:
    c = f.read()

# I need to reverse the } to > replacement. 
# It replaced ALL } with >.
# That means every closing brace in the file is now a >.
