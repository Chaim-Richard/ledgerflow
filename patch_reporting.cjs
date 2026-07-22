const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
const reportEndpoint = `
  app.get("/api/v1/reports/pl", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId", 400);
      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const startDate = req.query.startDate as string || "1970-01-01";
      const endDate = req.query.endDate as string || "2099-12-31";

      const db = getDb();
      const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      let queryFn: FirebaseFirestore.Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
      if (req.query.startDate) queryFn = queryFn.where("date", ">=", startDate);
      if (req.query.endDate) queryFn = queryFn.where("date", "<=", endDate);

      const transactionsSnap = await queryFn.get();
      const transactions = transactionsSnap.docs.map(d => d.data() as any);

      const pl: any = {
        income: { total: 0, accounts: {} },
        expense: { total: 0, accounts: {} },
        grossProfit: 0,
        netIncome: 0
      };

      accounts.forEach(acc => {
        if (acc.type === 'income' || acc.type === 'expense') {
          pl[acc.type].accounts[acc.id] = { name: acc.name, balance: 0, parentId: acc.parentId };
        }
      });

      transactions.forEach(tx => {
        if (tx.status === 'void' || tx.status === 'voided') return;
        tx.lines?.forEach((line: any) => {
          if (!line.accountId) return;
          const account = accounts.find(a => a.id === line.accountId);
          if (account && (account.type === 'income' || account.type === 'expense')) {
             if (pl[account.type].accounts[account.id]) {
                const amt = line.amountCents || 0;
                pl[account.type].accounts[account.id].balance += (account.type === 'income' ? (amt * -1) : amt);
             }
          }
        });
      });

      let incomeTotal = 0;
      Object.values(pl.income.accounts).forEach((a: any) => incomeTotal += a.balance);
      pl.income.total = incomeTotal;

      let expenseTotal = 0;
      Object.values(pl.expense.accounts).forEach((a: any) => expenseTotal += a.balance);
      pl.expense.total = expenseTotal;

      pl.grossProfit = incomeTotal;
      pl.netIncome = incomeTotal - expenseTotal;

      res.json({ status: "success", data: pl });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });
`;

serverCode = serverCode.replace('// --- Core Application Routes ---', '// --- Core Application Routes ---' + reportEndpoint);
fs.writeFileSync('server.ts', serverCode);
