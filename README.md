# Reels do No Play No Games

Publicação automática dos Shorts do canal [No Play No Games](https://www.youtube.com/@noplaynogamess) como Reels no Instagram [@noplaynogamess](https://www.instagram.com/noplaynogamess/), no mesmo modelo do EstudePlan.

- `agenda.json`: o que sai e quando (horário de Brasília).
- `reels/`: os vídeos que ainda vão sair. O GitHub Pages deixa cada um num link público, que é o que a API da Meta exige. Depois de publicado, o vídeo é apagado daqui.
- `scripts/publicar-agenda.mjs`: publica o que já está na hora. Roda no GitHub Actions a cada 15 minutos (`.github/workflows/reels.yml`), com o token no segredo `META_IG_ACCESS_TOKEN`.

Para agendar um Short, use `node ferramentas/instagram-agendar.mjs` na pasta do projeto No Play No Games.
