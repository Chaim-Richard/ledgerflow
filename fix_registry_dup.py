import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

# I may have accidentally added another duplicate of helpdesk, crm etc. earlier. Let's make sure.
# Wait, actually I just replaced "dashboard" with "dashboard" + my stuff. It shouldn't have duplicated.

# Let's check if lint is fine.
