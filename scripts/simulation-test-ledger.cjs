const assert=require('node:assert/strict');
module.exports=function verifyLedger(exchange){
  const cash=[...exchange.accounts,exchange.player,...exchange.markets.flatMap(m=>m.background)].reduce((sum,a)=>sum+a.cash,0);
  const costs=exchange.interestTreasury+exchange.markets.reduce((sum,m)=>sum+m.treasury,0);
  assert.equal(cash+costs,exchange.initialCash,'cash plus collected fees and interest is conserved');
  for(const m of exchange.markets)assert.equal(m.allAgents().reduce((sum,a)=>sum+a.shares,0),m.totalShares,'net shares equal fixed issuance');
};
