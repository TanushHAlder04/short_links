 'use client'
import { useRef, useState } from 'react'
export default function ReportControls({shortCode,traffic='human',range,onRangeChange}) {
  const [mode,setMode]=useState('daily'),[busy,setBusy]=useState(''),[feedback,setFeedback]=useState(''),[custom,setCustom]=useState(range?.range==='custom'),[start,setStart]=useState(range?.start||''),[end,setEnd]=useState(range?.end||'')
  const guard=useRef(false)
  const [openedAt]=useState(()=>Date.now())
  const rawAvailable=!range?.start || new Date(range.start+'T00:00:00Z').getTime()>=openedAt-90*86400000
  async function download(format) {
    if(guard.current)return
    guard.current=true;setBusy(format);setFeedback('')
    try {
      const params=new URLSearchParams({...range,traffic,mode,format,...(shortCode?{shortCode}:{})})
      const response=await fetch('/api/reports/export?'+params)
      if(!response.ok){const error=await response.json();throw new Error(error.message||'Export failed')}
      const blob=await response.blob(), url=URL.createObjectURL(blob), a=document.createElement('a')
      a.href=url;a.download=response.headers.get('Content-Disposition')?.match(/filename="([^"\r\n]+)"/)?.[1]||`shortlinks-report.${format}`
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)
      setFeedback(`${format.toUpperCase()} download started`)
    } catch(error) {setFeedback(error.message||'Export failed; please retry')}
    finally {guard.current=false;setBusy('')}
  }
  return <section aria-label="Analytics exports" className="glass-card" style={{padding:20,marginBottom:24}}>
    <h3 style={{marginBottom:12}}>Analytics reports</h3>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
      <label>Date range (UTC)<select aria-label="Report date range" value={custom?'custom':range?.range||'30'} disabled={!!busy} onChange={e=>{const value=e.target.value;setCustom(value==='custom');if(value!=='custom')onRangeChange({range:value})}} className="input-field"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select></label>
      {custom && <><label>Start<input aria-label="Report start date" type="date" value={start} onChange={e=>setStart(e.target.value)} /></label><label>End<input aria-label="Report end date" type="date" value={end} onChange={e=>setEnd(e.target.value)} /></label><button className="btn-secondary" disabled={!!busy||!start||!end} onClick={()=>onRangeChange({range:'custom',start,end})}>Apply dates</button></>}
      <label>CSV data<select aria-label="CSV export mode" value={mode} onChange={e=>setMode(e.target.value)} disabled={!!busy} className="input-field"><option value="links">Links (period counts)</option><option value="daily">Daily aggregates</option><option value="dimensions">Dimension aggregates</option><option value="raw" disabled={!rawAvailable}>Recent raw events</option></select></label>
      <button className="btn-secondary" disabled={!!busy||(mode==='raw'&&!rawAvailable)} onClick={()=>download('csv')}>{busy==='csv'?'Preparing CSV...':'Export CSV'}</button>
      <button className="btn-primary" disabled={!!busy} onClick={()=>download('pdf')}>{busy==='pdf'?'Preparing PDF...':'Download PDF'}</button>
    </div>
    <p style={{marginTop:12,fontSize:12,color:'var(--text-muted)'}}>Scope: {shortCode||'all owned links'} | Traffic: {traffic} | Daily buckets: UTC. Raw events require complete days within 90 days. Older periods use permanent aggregates.</p>
    {!rawAvailable && <p>Raw export unavailable for this range. Choose daily or dimension aggregates.</p>}
    <p role="status" aria-live="polite">{feedback}</p>
  </section>
}
