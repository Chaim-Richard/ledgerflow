#!/bin/bash
# Patch public registration route
sed -i '/app.get("\/api\/v1\/public\/registration-status"/,/catch/ s/const usersSnap = await db.collection("users").get();/const usersSnap = await db.collection("users").count().get();/g' server.ts
sed -i '/app.get("\/api\/v1\/public\/registration-status"/,/catch/ s/const totalUsers = usersSnap.size;/const totalUsers = usersSnap.data().count;/g' server.ts

# Patch admin users route
sed -i '/app.get("\/api\/v1\/admin\/users"/,/usersSnap.docs/ s/const usersSnap = await db.collection("users").get();/const usersSnap = await db.collection("users").limit(100).get();\n      const countSnap = await db.collection("users").count().get();\n      const totalCount = countSnap.data().count;/g' server.ts
sed -i '/app.get("\/api\/v1\/admin\/users"/,/res.json/ s/status: "success",/status: "success",\n        totalCount,/g' server.ts
