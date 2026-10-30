import { it,expect,vi,beforeEach } from 'vitest'
vi.mock('next-auth',()=>({getServerSession:vi.fn()}))
vi.mock('../app/api/auth/[...nextauth]/route.js',()=>({authOptions:{}}))
vi.mock('../lib/apikeys.js',()=>({validateApiKey:vi.fn()}))
vi.mock('../lib/prisma.js',()=>({prisma:{session:{findUnique:vi.fn()}}}))
import {getServerSession} from 'next-auth'
import {validateApiKey} from '../lib/apikeys.js'
import {prisma} from '../lib/prisma.js'
import {identityFor} from '../lib/identity.js'
import {errorResponse} from '../lib/errors.js'
beforeEach(()=>{vi.resetAllMocks()})
it('preserves API-key identity and rejects invalid bearer credentials',async()=>{validateApiKey.mockResolvedValue({id:'key',userId:'owner'});const request=new Request('https://short.test',{headers:{authorization:'Bearer sl_value'}});expect(await identityFor(request)).toEqual({type:'apiKey',apiKeyId:'key',userId:'owner'});validateApiKey.mockResolvedValue(null);await expect(identityFor(request)).rejects.toMatchObject({status:401})})
it('returns an ordinary database-session identity',async()=>{getServerSession.mockResolvedValue({user:{id:'owner'}});expect(await identityFor(new Request('https://short.test'))).toEqual({type:'session',userId:'owner'});expect(prisma.session.findUnique).not.toHaveBeenCalled()})
it('keeps anonymous access and rejects missing private identity',async()=>{expect(await identityFor(new Request('https://short.test'))).toEqual({});await expect(identityFor(new Request('https://short.test'),{required:true})).rejects.toMatchObject({status:401})})
it('distinguishes a swallowed adapter outage from an expired session',async()=>{const request=new Request('https://short.test',{headers:{cookie:'__Secure-next-auth.session-token=opaque-token'}});prisma.session.findUnique.mockRejectedValue(Error('offline'));try{await identityFor(request,{required:true});throw Error('unexpected success')}catch(error){expect(errorResponse(error).status).toBe(503)}prisma.session.findUnique.mockResolvedValue(null);await expect(identityFor(request,{required:true})).rejects.toMatchObject({status:401})})
