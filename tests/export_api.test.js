import {it,expect,vi,beforeEach} from 'vitest'
import {AppError} from '../lib/errors.js'
vi.mock('@/lib/identity',()=>({identityFor:vi.fn()}))
vi.mock('@/lib/ratelimit',()=>({enforceLimit:vi.fn()}))
vi.mock('@/lib/services/reports',()=>({analyticsReport:vi.fn(),rawReportRows:vi.fn()}))
import {identityFor} from '@/lib/identity'
import {enforceLimit} from '@/lib/ratelimit'
import {analyticsReport,rawReportRows} from '@/lib/services/reports'
import {GET} from '../app/api/reports/export/route.js'
beforeEach(()=>{vi.resetAllMocks();identityFor.mockResolvedValue({userId:'owner'});enforceLimit.mockResolvedValue({'X-RateLimit-Limit':'5'});analyticsReport.mockResolvedValue({dailyRows:[],dimensionRows:[],links:[]})})
it('requires authentication and does not query data on rejection',async()=>{identityFor.mockRejectedValue(new AppError('Sign in',401));expect((await GET(new Request('https://test/api/reports/export'))).status).toBe(401);expect(analyticsReport).not.toHaveBeenCalled()})
it('uses server owner, attachment headers, UTC and no-store',async()=>{const r=await GET(new Request('https://test/api/reports/export?userId=victim&traffic=bot'));expect(r.status).toBe(200);expect(analyticsReport.mock.calls[0][0]).toBe('owner');expect(analyticsReport.mock.calls[0][1].traffic).toBe('bot');expect(r.headers.get('content-type')).toBe('text/csv; charset=utf-8');expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="shortlinks-account-/);expect(r.headers.get('cache-control')).toContain('no-store');expect(await r.text()).toContain('"date","shortCode"')})
it('returns controlled rate-limit responses before expensive work',async()=>{const e=new AppError('Too many requests',429,'RATE_LIMITED');e.headers={'Retry-After':'60'};enforceLimit.mockRejectedValue(e);const r=await GET(new Request('https://test/api/reports/export'));expect(r.status).toBe(429);expect(r.headers.get('retry-after')).toBe('60');expect(analyticsReport).not.toHaveBeenCalled()})
it('routes bounded raw exports and propagates retention/size errors',async()=>{rawReportRows.mockRejectedValue(new AppError('Choose aggregates',413,'EXPORT_TOO_LARGE'));const r=await GET(new Request('https://test/api/reports/export?mode=raw'));expect(r.status).toBe(413);expect((await r.json()).message).toBe('Choose aggregates');expect(analyticsReport).not.toHaveBeenCalled()})
