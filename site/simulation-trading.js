const fmt=(value,digits=0)=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:digits}).format(value);
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>(value>0?'+':'')+fmt(value,2);
const money=value=>fmt(value/10000,1)+'만원';
const statusLabels={queued:'접수',open:'대기',partial:'부분 체결',filled:'체결 완료',partialCanceled:'부분 체결·잔량 취소',canceled:'취소',unfilled:'미체결·잔량 취소'};
const isActive=order=>order && ['queued','open','partial'].includes(order.status);

export class TradingPanel {
  constructor(root,{state,getContext,advance,onNotice,onLayout,onLeverage,onShowParticipants,onMarketChange}){
    this.root=root;this.state=state;this.getContext=getContext;this.advance=advance;this.onNotice=onNotice;this.onLayout=onLayout;this.onLeverage=onLeverage;this.onShowParticipants=onShowParticipants;this.onMarketChange=onMarketChange;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    this.toggle=document.createElement('button');this.toggle.type='button';this.toggle.className='sim-manual-toggle';
    root.querySelector('.sim-company').append(this.toggle);
    this.element=document.createElement('aside');this.element.className='sim-trading-ticket';this.element.setAttribute('aria-label','직접 거래');
    this.element.innerHTML=`<div class="sim-trading-tabs" role="group" aria-label="내 거래 화면">${[['order','주문'],['account','내 계좌'],['reaction','참여자 반응']].map(([key,label])=>`<button type="button" data-trading-view="${key}">${label}</button>`).join('')}</div>
      <section data-trading-panel="order"><p class="sim-player-cash" id="simPlayerCash"></p><form id="simOrderForm"><div class="sim-order-sides" role="group" aria-label="주문 방향">${[['buy','매수'],['sell','매도'],['short','공매도']].map(([key,label])=>`<button type="button" data-order-action="${key}">${label}</button>`).join('')}</div><div class="sim-order-fields"><label for="simOrderType"><span>주문 종류</span><select id="simOrderType"><option value="market">시장가</option><option value="limit">지정가</option></select></label><label for="simOrderLeverage"><span>계좌 차입 한도</span><select id="simOrderLeverage">${[1,2,3].map(value=>`<option value="${value}">${value}배${value===1?' · 차입 없음':''}</option>`).join('')}</select></label><label for="simOrderQuantity"><span>수량 <small>주</small><button type="button" data-order-max>최대</button></span><input id="simOrderQuantity" type="number" min="1" max="10000000" step="1" required></label><label for="simOrderLimit"><span id="simOrderPriceLabel">예상 가격 <small>원</small></span><input id="simOrderLimit" type="number" min="1" max="1000000000" step="1" required></label></div><div class="sim-order-estimate"><span id="simOrderEstimate"></span><small id="simOrderCapacity"></small></div><button type="submit" class="button primary" id="simSubmitOrder">매수 주문</button><p id="simOrderError" class="sim-order-error" role="alert"></p></form><div id="simManualOrderStatus" class="sim-manual-order-status" role="status"></div></section>
      <section data-trading-panel="account" hidden><div id="simPlayerMetrics" class="sim-player-metrics"></div><p id="simPlayerExposure" class="sim-player-exposure"></p><div id="simPlayerPositions" class="sim-player-positions"></div><div id="simPlayerPositionPager" class="sim-manual-pager"></div></section>
      <section data-trading-panel="reaction" hidden><div id="simManualImpact" class="sim-manual-impact"></div><p id="simReactionCounts" class="sim-reaction-counts"></p><div id="simManualReactions" class="sim-manual-reactions"></div><div id="simReactionPager" class="sim-manual-pager"></div><div class="sim-reaction-actions"><button type="button" class="sim-subtle-button" data-next-reaction>10초 진행</button><button type="button" class="sim-subtle-button" data-all-reactions>참여자 현황 →</button></div></section>`;
    root.querySelector('.sim-terminal-body').append(this.element);
    this.$=selector=>this.element.querySelector(selector);
    this.$('#simOrderQuantity').value=state.quantity;
    this.$('#simOrderType').value=state.type;
    this.toggle.addEventListener('click',()=>{state.show=!state.show;this.paint();onLayout();},options);
    this.element.addEventListener('click',event=>{
      const view=event.target.closest('[data-trading-view]');if(view){state.view=view.dataset.tradingView;this.paint();return;}
      const action=event.target.closest('[data-order-action]');if(action){state.action=action.dataset.orderAction;this.$('#simOrderError').textContent='';this.paint();return;}
      if(event.target.closest('[data-order-max]')){const context=getContext();state.quantity=String(context.exchange.maxOrderQuantity(context.market.assetId,state.action,state.type,this.$('#simOrderLimit').value));this.$('#simOrderQuantity').value=state.quantity;this.paint();return;}
      if(event.target.closest('[data-cancel-manual]')){getContext().exchange.cancelOrder(getContext().market.assetId);onMarketChange();onNotice('대기 주문을 취소했습니다.');return;}
      const symbol=event.target.closest('[data-player-symbol]');if(symbol){root.querySelector('#simSecuritySelect').value=symbol.dataset.playerSymbol;root.querySelector('#simSecuritySelect').dispatchEvent(new Event('change',{bubbles:true}));state.view='order';this.paint();return;}
      const positionPage=event.target.closest('[data-position-page]');if(positionPage){state.positionPage+=Number(positionPage.dataset.positionPage);this.paint();return;}
      const reactionPage=event.target.closest('[data-reaction-page]');if(reactionPage){state.reactionPage+=Number(reactionPage.dataset.reactionPage);this.paint();return;}
      if(event.target.closest('[data-next-reaction]')){advance();return;}
      if(event.target.closest('[data-all-reactions]'))onShowParticipants();
    },options);
    this.$('#simOrderForm').addEventListener('input',event=>{
      if(event.target.matches('select'))return;
      if(event.target.id==='simOrderQuantity')state.quantity=event.target.value;
      if(event.target.id==='simOrderLimit')state.limits[getContext().market.assetId]=event.target.value;
      this.$('#simOrderError').textContent='';this.paint();
    },options);
    this.$('#simOrderType').addEventListener('change',event=>{state.type=event.target.value;this.paint();},options);
    this.$('#simOrderLeverage').addEventListener('change',event=>{
      try{getContext().exchange.setLeverage(event.target.value);onLeverage(Number(event.target.value));this.paint();onNotice('계좌 차입 한도를 바꿨습니다. 대기 주문은 취소되며, 담보 부족 시 다음 틱에 포지션을 줄입니다.');}
      catch(error){this.$('#simOrderError').textContent=error.message;}
    },options);
    this.$('#simOrderForm').addEventListener('submit',event=>{
      event.preventDefault();const context=getContext();
      if(context.dirty)return;
      try{
        const order=context.exchange.submitOrder(context.market.assetId,{action:state.action,type:state.type,quantity:this.$('#simOrderQuantity').value,limit:this.$('#simOrderLimit').value});
        state.reactionPage=0;this.$('#simOrderError').textContent='';
        if(!context.running)advance();
        this.paint();onNotice(context.running?'직접 주문을 접수했습니다. 다음 틱에서 체결합니다.':order.filledQuantity?`${statusLabels[order.status]} · ${fmt(order.filledQuantity)}주 체결. 참여자 반응에서 다음 틱을 진행할 수 있습니다.`:`${statusLabels[order.status]} · ${order.type==='limit'?'지정가 잔량을 유지합니다.':'호가와 주문 여력을 확인하세요.'}`);
      }catch(error){this.$('#simOrderError').textContent=error.message;}
    },options);
    this.paint();
  }

  pager(attribute,page,total,size){return `<button type="button" ${attribute}="-1" ${page<=0?'disabled':''} aria-label="이전 페이지">←</button><span>${page+1} / ${Math.max(1,Math.ceil(total/size))}</span><button type="button" ${attribute}="1" ${page>=Math.ceil(total/size)-1?'disabled':''} aria-label="다음 페이지">→</button>`;}
  paint(){
    const {exchange,market,dirty,running}=this.getContext(),state=this.state,player=exchange.playerSnapshot(),order=market.manualOrder;
    const halted=exchange.controls.snapshot().halted,blocked=dirty || halted;
    this.element.hidden=!state.show;this.toggle.textContent=state.show?'호가·차트':'직접 거래';this.toggle.setAttribute('aria-expanded',String(state.show));
    this.root.querySelector('.sim-terminal').dataset.trading=String(state.show);
    for(const button of this.element.querySelectorAll('[data-trading-view]'))button.setAttribute('aria-pressed',String(button.dataset.tradingView===state.view));
    for(const panel of this.element.querySelectorAll('[data-trading-panel]'))panel.hidden=panel.dataset.tradingPanel!==state.view;
    for(const button of this.element.querySelectorAll('[data-order-action]')){button.setAttribute('aria-pressed',String(button.dataset.orderAction===state.action));button.disabled=blocked;}
    if(this.assetId!==market.assetId){this.assetId=market.assetId;this.$('#simOrderLimit').value=state.limits[market.assetId] ?? market.price;this.$('#simOrderError').textContent='';}
    const isMarket=state.type==='market';
    if(isMarket)this.$('#simOrderLimit').value=market.price;
    else if(state.limits[market.assetId]!==undefined)this.$('#simOrderLimit').value=state.limits[market.assetId];
    this.$('#simOrderLimit').disabled=isMarket || blocked;
    this.$('#simOrderPriceLabel').innerHTML=`${isMarket?'예상 가격':'지정가'} <small>원</small>`;
    for(const id of ['#simOrderType','#simOrderLeverage','#simOrderQuantity'])this.$(id).disabled=blocked;
    this.$('[data-order-max]').disabled=blocked;
    this.$('#simOrderLeverage').value=String(player.leverage);
    const actionLabel={buy:'매수',sell:'매도',short:'공매도'}[state.action],quantity=Number(this.$('#simOrderQuantity').value),price=Number(this.$('#simOrderLimit').value);
    const maximum=exchange.maxOrderQuantity(market.assetId,state.action,state.type,price);
    this.$('#simPlayerCash').textContent=`현금 ${money(player.cash)} · 차입 ${money(player.debt)}`;
    this.$('#simOrderEstimate').textContent=Number.isFinite(quantity*price)?`예상 ${money(quantity*price)}`:'수량과 가격을 입력하세요';
    this.$('#simOrderCapacity').textContent=`최대 ${fmt(maximum)}주`;
    this.$('#simSubmitOrder').textContent=halted?'거래 재개 대기':`${actionLabel} 주문`;
    this.$('#simSubmitOrder').disabled=blocked || Boolean(isActive(order));
    this.$('#simSubmitOrder').dataset.side=state.action;
    this.$('#simManualOrderStatus').innerHTML=order?`<span>${halted?'거래 중단 · ':''}${statusLabels[order.status]} · ${fmt(order.filledQuantity)} / ${fmt(order.quantity)}주${order.filledQuantity?` · 평균 ${fmt(order.amount/order.filledQuantity,2)}원`:''}</span>${isActive(order)?'<button type="button" data-cancel-manual>주문 취소</button>':''}`:`<span>${halted?'가상 시간을 진행하면 거래가 재개됩니다.':'일시정지 중 주문하면 가상 10초가 진행됩니다.'}</span>`;
    const metrics=[['순자산',money(player.equity)],['손익',signed(player.profit/10000)+'만원'],['현금',money(player.cash)],['차입금',money(player.debt)]];
    this.$('#simPlayerMetrics').innerHTML=metrics.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    this.$('#simPlayerExposure').textContent=`총 보유 ${fmt(player.exposure,2)}배 / 한도 ${player.leverage}배 · 반대매매 ${player.marginCalls}회`;
    state.positionPage=Math.max(0,Math.min(state.positionPage,Math.ceil(player.positions.length/3)-1));
    this.$('#simPlayerPositions').innerHTML=player.positions.slice(state.positionPage*3,state.positionPage*3+3).map(position=>`<div><button type="button" data-player-symbol="${position.id}">${esc(position.company)}</button><span>${fmt(position.shares)}주 <small>${position.shares?`평균 ${fmt(position.averageCost,2)}원`:'미보유'}</small></span><strong>${signed(position.unrealizedPnL/10000)}<small>만원</small></strong></div>`).join('');
    this.$('#simPlayerPositionPager').innerHTML=this.pager('data-position-page',state.positionPage,player.positions.length,3);
    const reaction=order?.reaction;
    this.$('#simManualImpact').innerHTML=!order?'<p>직접 주문 후 체결과 참여자 반응을 확인할 수 있습니다.</p>':!order.filledQuantity?`<strong>${statusLabels[order.status]}</strong><p>아직 체결된 수량이 없습니다.</p>`:`<strong>${actionLabelFor(order.action)} ${fmt(order.filledQuantity)}주 · 평균 ${fmt(order.amount/order.filledQuantity,2)}원</strong><p>주문 전 ${fmt(order.beforePrice)} → ${fmt(order.afterPrice)}원 (${signed((order.afterPrice/order.beforePrice-1)*100)}%)</p><small>주문 전후 변동에는 같은 틱의 다른 체결도 포함됩니다.</small>`;
    this.$('#simReactionCounts').textContent=reaction?`체결 다음 틱 · 매수 ${reaction.buy}명 · 매도 ${reaction.sell}명 · 관망 ${reaction.hold}명`:order?.filledQuantity?'10초를 진행하면 체결 후 첫 반응을 기록합니다.':'';
    const agents=reaction?.agents || [];
    state.reactionPage=Math.max(0,Math.min(state.reactionPage,Math.ceil(agents.length/2)-1));
    this.$('#simManualReactions').innerHTML=agents.slice(state.reactionPage*2,state.reactionPage*2+2).map(agent=>`<div title="${esc(agent.reason)}"><span>${esc(agent.name)}<small>${esc(agent.label)}</small></span><strong>${agent.quantity?`${agent.side==='buy'?'매수':'매도'} ${fmt(agent.quantity)}주`:'주문 없음'}</strong></div>`).join('');
    this.$('#simReactionPager').innerHTML=agents.length?this.pager('data-reaction-page',state.reactionPage,agents.length,2):'';
    this.$('[data-next-reaction]').disabled=dirty || running;
  }
  destroy(){this.abort.abort();}
}
const actionLabelFor=action=>({buy:'매수',sell:'매도',short:'공매도'}[action]);
