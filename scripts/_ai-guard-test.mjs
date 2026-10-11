// De AI-routes laten alleen verzoeken met eigen Origin en een geldige Spotify-sessie
// door (api/_guard.js). Gedragstests die de handlers direct aanroepen gebruiken deze
// headers, en primeAIGuard() laat de poort het testtoken één keer echt controleren
// (tegen een nep-Spotify) zodat het daarna uit zijn cache komt en de fetch-mocks van
// de test zelf niet geraakt worden.
import {spotifyUser} from '../api/_guard.js';
export const AI_TEST_TOKEN='test-spotify-token-0123456789';
export const AI_HEADERS={host:'josh-fm.vercel.app',origin:'https://josh-fm.vercel.app',authorization:`Bearer ${AI_TEST_TOKEN}`};
export const withAI=req=>({...req,headers:{...AI_HEADERS,...(req?.headers||{})}});
export async function primeAIGuard(){
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({id:'mair-test-user'})});
  try{const who=await spotifyUser({headers:AI_HEADERS});if(!who.ok)throw new Error(`AI-poort niet te primen: ${who.error}`)}
  finally{globalThis.fetch=original}
}
