import {aggregateCandles, marketTime, TICKS_PER_CANDLE} from './simulation-engine.js';

const fmt = (value, digits = 0) => new Intl.NumberFormat('ko-KR', {maximumFractionDigits:digits}).format(value);
const COLORS = {background:'#ffffff', grid:'#f0f2f5', text:'#7b8491', up:'#f04452', down:'#3182f6', flat:'#adb5bd', ma20:'#e4a64b', ma60:'#8b7fc7'};

export class SimulationChart {
  constructor(root, getMarket) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.context = this.canvas.getContext('2d');
    this.getMarket = getMarket;
    this.period = 1;
    this.count = 65;
    this.offset = 0;
    this.hover = null;
    this.drag = null;
    this.frame = 0;
    this.abort = new AbortController();
    const options = {signal:this.abort.signal};
    this.canvas.addEventListener('pointermove', e => this.pointer(e), options);
    this.canvas.addEventListener('pointerleave', () => { if (!this.drag) {this.hover = null; this.render();} }, options);
    this.canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      this.drag = {x:e.clientX, offset:this.offset};
      this.canvas.setPointerCapture(e.pointerId);
    }, options);
    this.canvas.addEventListener('pointerup', () => {this.drag = null;}, options);
    this.canvas.addEventListener('pointercancel', () => {this.drag = null;}, options);
    this.canvas.addEventListener('wheel', e => {e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2);}, {...options, passive:false});
    this.canvas.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','+','=','-','Home'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Home') this.offset = 0;
      else if (e.key === '+' || e.key === '=') this.zoom(1 / 1.25);
      else if (e.key === '-') this.zoom(1.25);
      else this.offset += e.key === 'ArrowLeft' ? 5 : -5;
      this.render();
    }, options);
    root.addEventListener('click', e => {
      const button = e.target.closest('[data-chart]');
      if (!button) return;
      const action = button.dataset.chart;
      if (action === 'period') {
        this.period = Number(button.dataset.period); this.offset = 0;
        root.querySelectorAll('[data-chart="period"]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      } else if (action === 'in') this.zoom(1 / 1.25);
      else if (action === 'out') this.zoom(1.25);
      else if (action === 'latest') {this.offset = 0; this.hover = null;}
      this.render();
    }, options);
    this.resize = new ResizeObserver(() => this.render());
    this.resize.observe(this.canvas);
    this.render();
  }

  zoom(factor) { this.count = Math.max(15, Math.min(240, Math.round(this.count * factor))); this.render(); }

  pointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (this.drag) {
      const width = (rect.width - 78) / this.count;
      this.offset = this.drag.offset + Math.round((event.clientX - this.drag.x) / width);
    }
    this.hover = {x:event.clientX - rect.left, y:event.clientY - rect.top};
    this.render();
  }

  reset() {this.offset = 0; this.hover = null; this.render();}

  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {this.frame = 0; this.draw();});
  }

  draw() {
    const market = this.getMarket(), ctx = this.context;
    const rect = this.canvas.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    if (!ctx || W < 100 || H < 100) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = COLORS.background; ctx.fillRect(0,0,W,H);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", sans-serif';
    const compact=H<240;
    const L = 14, R = 77, T = compact?24:29, B = H - (compact?65:91), V = H - (compact?26:34);
    const all = aggregateCandles(market.candles, this.period);
    this.offset = Math.max(0, Math.min(Math.max(0, all.length - 5), this.offset));
    const end = all.length - this.offset, start = Math.max(0,end - this.count);
    const visible = all.slice(start,end);
    const values = visible.length ? visible.flatMap(c => [c.high,c.low]) : [market.price * 0.985, market.price * 1.015];
    const padding = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, market.price * 0.003);
    const ymin = Math.max(0, Math.min(...values) - padding), ymax = Math.max(...values) + padding;
    const y = value => B - (value - ymin) / (ymax - ymin) * (B - T);
    const plotWidth = W - L - R, step = plotWidth / this.count;
    const x = index => L + (index + 0.5) * step;
    const drawText = (text, px, py, color = COLORS.text, align = 'left') => {
      ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text,px,py);
    };
    ctx.lineWidth = 1;
    const divisions=compact?3:5;
    for (let i = 0; i <= divisions; i++) {
      const value = ymin + (ymax - ymin) * i / divisions, py = Math.round(y(value)) + 0.5;
      ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(L,py); ctx.lineTo(W-R,py); ctx.stroke();
      drawText(fmt(value), W-R+10,py+4);
    }
    ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(L,B+15.5); ctx.lineTo(W-R,B+15.5); ctx.stroke();
    drawText('거래량', L, B+(compact?13:29), COLORS.text);
    const maxVolume = Math.max(1, ...visible.map(c => c.volume));
    ctx.save(); ctx.beginPath(); ctx.rect(L,T,plotWidth,B-T); ctx.clip();
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i], px = x(i), color = c.close > c.open ? COLORS.up : c.close < c.open ? COLORS.down : COLORS.flat;
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(Math.round(px)+0.5,y(c.high)); ctx.lineTo(Math.round(px)+0.5,y(c.low)); ctx.stroke();
      const top = Math.min(y(c.open),y(c.close)), height = Math.max(1.5,Math.abs(y(c.open)-y(c.close)));
      ctx.fillRect(px-Math.max(2,step*0.65)/2,top,Math.max(2,step*0.65),height);
    }
    for (const [length,color] of [[20,COLORS.ma20],[60,COLORS.ma60]]) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.25; ctx.beginPath();
      let started = false;
      for (let i = 0; i < visible.length; i++) {
        const index = start+i;
        if (index+1 < length) continue;
        const mean = all.slice(index-length+1,index+1).reduce((sum,c) => sum+c.close,0)/length;
        if (!started) {ctx.moveTo(x(i),y(mean)); started = true;} else ctx.lineTo(x(i),y(mean));
      }
      ctx.stroke();
    }
    ctx.restore(); ctx.lineWidth = 1;
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      ctx.fillStyle = c.close >= c.open ? '#f044524d' : '#3182f64d';
      const height = c.volume/maxVolume*(compact?24:40);
      ctx.fillRect(x(i)-Math.max(2,step*0.65)/2,V-height,Math.max(2,step*0.65),height);
    }
    const every = Math.max(5, Math.ceil(this.count / (W < 500 ? 3 : 6) / 5) * 5);
    for (let i = 0; i < visible.length; i++) {
      if (i % every !== 0) continue;
      const px = x(i);
      ctx.strokeStyle = COLORS.grid; ctx.beginPath(); ctx.moveTo(Math.round(px)+0.5,T); ctx.lineTo(Math.round(px)+0.5,V); ctx.stroke();
      drawText(marketTime(visible[i].index*TICKS_PER_CANDLE,false),px,H-12,COLORS.text,'center');
    }
    const lastY = y(market.price), priceColor = market.price >= market.config.initialPrice ? COLORS.up : COLORS.down;
    if (lastY >= T && lastY <= B) {
      ctx.setLineDash([4,4]); ctx.strokeStyle = priceColor; ctx.beginPath(); ctx.moveTo(L,lastY); ctx.lineTo(W-R,lastY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = priceColor; ctx.fillRect(W-R+1,lastY-10,R-7,20);
      drawText(fmt(market.price),W-R+8,lastY+4,'#ffffff');
    }
    let selected = visible.at(-1);
    if (this.hover && this.hover.x >= L && this.hover.x < W-R && this.hover.y >= T && this.hover.y < V) {
      const index = Math.floor((this.hover.x-L)/step), candle = visible[index];
      if (candle) {
        selected = candle;
        const px = x(index), py = this.hover.y;
        ctx.strokeStyle = '#8b95a1'; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(px,T); ctx.lineTo(px,V); ctx.moveTo(L,py); ctx.lineTo(W-R,py); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#f2f4f6'; ctx.fillRect(Math.max(L,Math.min(W-R-85,px-42)),V+4,85,21);
        drawText(marketTime(candle.index*TICKS_PER_CANDLE,false),Math.max(L+42,Math.min(W-R-43,px)),V+18,'#4e5968','center');
        if (py <= B) {
          const price = ymin + (B-py)/(B-T)*(ymax-ymin);
          ctx.fillStyle = '#f2f4f6'; ctx.fillRect(W-R+1,py-10,R-7,20); drawText(fmt(price),W-R+8,py+4,'#4e5968');
        }
      }
    }
    if (!all.length) {
      drawText('체결 내역 없음',L+plotWidth/2,(T+B)/2,'#6b7684','center');
      drawText('실행 후 체결된 가격을 표시합니다.',L+plotWidth/2,(T+B)/2+24,COLORS.text,'center');
    }
    drawText(`${this.period}분봉`,L,17,'#6b7684');
    drawText('MA 20',L+50,17,COLORS.ma20); drawText('MA 60',L+102,17,COLORS.ma60);
    const ohlc = this.root.querySelector('[data-chart-ohlc]');
    if (selected) {
      ohlc.textContent = `${marketTime(selected.index*TICKS_PER_CANDLE,false)}  시 ${fmt(selected.open)}  고 ${fmt(selected.high)}  저 ${fmt(selected.low)}  종 ${fmt(selected.close)}  ·  거래량 ${fmt(selected.volume)}주`;
    } else ohlc.textContent = `시작가 ${fmt(market.price)}원 · 1틱 = 가상 10초 · 캔들마다 6틱`;
    this.canvas.setAttribute('aria-label', `${market.config.company} ${this.period}분봉. 현재가 ${fmt(market.price)}원, 누적 체결량 ${fmt(market.totalVolume)}주. 방향키로 이동, 더하기·빼기로 확대·축소, Home 키로 최근 보기.`);
    const latest = this.root.querySelector('[data-chart="latest"]');
    latest.classList.toggle('has-history',this.offset > 0);
  }

  destroy() {this.abort.abort(); this.resize.disconnect(); cancelAnimationFrame(this.frame);}
}
