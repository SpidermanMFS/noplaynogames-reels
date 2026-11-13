#!/usr/bin/env node
/**
 * Publica no Instagram @noplaynogamess os Reels da agenda cuja hora já chegou.
 * Roda no GitHub Actions (.github/workflows/reels.yml) a cada 15 min; também roda no PC.
 *
 * agenda.json: [{ "id", "quando" (ISO com fuso), "arquivo" (em reels/), "legenda", "capaMs"?, "segurar"?, "publicado"? }]
 * - "segurar": true  -> não publica (ex.: Short que depende de uma conferência no dia).
 * - Item atrasado mais de 24 h não é publicado sozinho: fica marcado "atrasado" para o Mateus decidir.
 * - Depois de publicar, apaga o vídeo de reels/ (o site fica só com o que ainda vai sair).
 *
 * Token: variável META_IG_ACCESS_TOKEN (segredo do repositório). Nunca é impresso.
 * O vídeo precisa estar no ar no GitHub Pages: https://spidermanmfs.github.io/noplaynogames-reels/reels/<arquivo>
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://graph.instagram.com/v21.0';
const SITE = 'https://spidermanmfs.github.io/noplaynogames-reels';
const TOKEN = process.env.META_IG_ACCESS_TOKEN;
const AGENDA = path.resolve('agenda.json');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
if (!TOKEN) { console.error('falta META_IG_ACCESS_TOKEN'); process.exit(1); }

async function post(seg, params) {
  const r = await fetch(`${API}/${seg}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, access_token: TOKEN }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`${seg}: ${d.error?.message || r.status}`);
  return d;
}

async function publicar(item) {
  const videoUrl = `${SITE}/reels/${encodeURIComponent(item.arquivo)}`;
  const head = await fetch(videoUrl, { method: 'HEAD' });
  if (!head.ok) throw new Error(`o vídeo ainda não está no site (${head.status}): ${videoUrl}`);
  const cont = await post('me/media', { media_type: 'REELS', video_url: videoUrl, caption: item.legenda, thumb_offset: String(item.capaMs ?? 3000), share_to_feed: 'true' });
  for (let i = 0; i < 60; i++) {
    await espera(5000);
    const st = await (await fetch(`${API}/${cont.id}?fields=status_code,status&access_token=${encodeURIComponent(TOKEN)}`)).json().catch(() => ({}));
    if (st.status_code === 'FINISHED') {
      const pub = await post('me/media_publish', { creation_id: cont.id });
      const info = await (await fetch(`${API}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(TOKEN)}`)).json().catch(() => ({}));
      return { mediaId: pub.id, permalink: info.permalink || null };
    }
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`a Meta não processou o vídeo: ${st.status || st.status_code}`);
  }
  throw new Error('o vídeo não ficou pronto em 5 minutos');
}

const agenda = JSON.parse(fs.readFileSync(AGENDA, 'utf8'));
const agora = Date.now();
let mudou = false;
for (const item of agenda) {
  if (item.publicado || item.segurar || item.atrasado) continue;
  const quando = Date.parse(item.quando);
  if (Number.isNaN(quando) || quando > agora) continue;
  if (agora - quando > 24 * 3600e3) { item.atrasado = true; mudou = true; console.log(`ATRASADO (não publicado): ${item.id}`); continue; }
  try {
    console.log(`publicando ${item.id}…`);
    const r = await publicar(item);
    Object.assign(item, { publicado: new Date().toISOString(), mediaId: r.mediaId, permalink: r.permalink });
    delete item.erro;
    const arq = path.join('reels', item.arquivo);
    if (fs.existsSync(arq)) fs.rmSync(arq);
    console.log(`OK ${item.id}: ${r.permalink || r.mediaId}`);
  } catch (e) {
    item.erro = `${new Date().toISOString()} ${e.message}`;
    console.error(`ERRO ${item.id}: ${e.message}`);
  }
  mudou = true;
}
if (mudou) fs.writeFileSync(AGENDA, JSON.stringify(agenda, null, 2) + '\n');
console.log(mudou ? 'agenda atualizada' : 'nada para publicar agora');
// erro faz a execução falhar: o GitHub manda e-mail ao dono do repositório (ex.: token vencido)
if (agenda.some((i) => i.erro && !i.publicado && Date.now() - Date.parse(i.erro.slice(0, 24)) < 20 * 60e3)) process.exitCode = 1;
