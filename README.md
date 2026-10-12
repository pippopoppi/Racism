# Slotcars Simulator 🏁

Simulatore di slot car 2D per browser: multiplayer locale, editor con spline di Catmull–Rom, fisica deterministica a 120 Hz, deragliamenti con riposizionamento, Quick Race e Time Attack. Tutto lato client, senza server di gioco.

## Pubblica su GitHub Pages (senza installare nulla sul PC)

1. Crea un repository GitHub, ad esempio `slotcars`.
2. Estrai **tutti** i file di questo ZIP e caricali **nella radice** del repository (non nella cartella `slotcars` annidata). Usa **Add file → Upload files** su GitHub oppure Git.
3. Assicurati che il branch principale si chiami **main**.
4. In **Settings → Pages → Build and deployment**, scegli **Source: GitHub Actions**.
5. Vai in **Actions**, apri il workflow **Deploy Slotcars to GitHub Pages**. Se non è ancora partito, premi **Run workflow**.
6. Dopo il workflow completato, il sito sarà su `https://TUO-USERNAME.github.io/slotcars/` (sostituisci nome utente e repository).

Il workflow installa dipendenze, esegue test, costruisce `dist/` e pubblica GitHub Pages. **Non devi caricare `node_modules/` né `dist/`**, né mantenere acceso un server: GitHub pubblica il sito statico.

> Se il repository è `TUO-USERNAME.github.io`, nel workflow cambia `BASE_PATH` da `/${{ github.event.repository.name }}/` a `/`.

## Sviluppo in locale

Richiede Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
# apri l'indirizzo indicato da Vite (di solito http://localhost:5173/)
```

```bash
npm run test  # test automatici di geometria e fisica
npm run build # genera dist/
npm run preview
```

Per simulare esattamente GitHub Pages sotto un percorso `/slotcars/`:

```bash
BASE_PATH=/slotcars/ npm run build
```

Per pubblicare il contenuto di `dist/` manualmente, puoi usarlo anche su un qualunque altro hosting statico.

## Giocare

- **Desktop:** acceleratori default A, L, V, freccia ↑, rimappabili da Impostazioni. I gamepad supportano il grilletto destro o lo stick.
- **Mobile:** ogni pilota usa il proprio trigger virtuale multitouch: dito nella parte alta = più gas; togli il dito = gas a zero. Su telefono si consigliano **due piloti in orizzontale**.
- **Gara rapida:** 1–4 piloti secondo il numero di corsie, 3/5/10 giri; classifica, tempi e ordine d'arrivo.
- **Time Attack:** prova libera, cronometraggio e record personale persistente per circuito (il ghost è intenzionalmente rimandato).
- **Deragliamento:** in curva un eccesso di accelerazione laterale sgancia l'auto; torna automaticamente al punto in cui era ancora agganciata, ferma, dopo 1,35 s.
- **Editor:** trascina i punti, aggiungi/elimina, undo/redo, zoom con rotella o pinch a due dita, pan trascinando lo sfondo. Regola 2–4 corsie, salva, modifica, importa/esporta JSON.

Se una geometria è troppo stretta, si incrocia o le corsie si sovrappongono, compare un messaggio e il test pista non si avvia finché non viene corretta.

## Fisica (modello semplificato, non arcade)

Posizione nello slot e velocità longitudinale con integrazione a **passo fisso 1/120 s**. Parametri uguali per tutte le auto. Unità: 100 coordinate grafiche = 1 m. Il passo longitudinale è

\[m\, \dot v = F_0 u \max(0, 1 - v / v_0) - c_d v^2 - F_r - F_b(1-u)\]

con le forze resistenti di rotolamento applicate quando la velocità è positiva. Verifica della guida tramite accelerazione laterale \(a_y=v^2|\kappa|\): deragliamento sopra la soglia. È un **modello ingegneristico semplificato**: non riproduce dettagli come distribuzione magnetica, variazione del coefficiente d'attrito, variazioni di tensione delle piste o attrito del pattino. I valori sono regolabili in `src/game/Physics.ts`:

| Parametro | Valore |
|---|---:|
| Massa | 0,085 kg |
| Forza motrice a fermo | 0,64 N |
| Velocità a vuoto | 5,2 m/s |
| Resistenza quadratica | 0,020 N/(m/s)² |
| Rotolamento | 0,030 N |
| Frenatura a gas rilasciato | 0,26 N |
| Soglia accelerazione laterale | 9,5 m/s² |
| Tempo recupero dopo sgancio | 1,35 s |

## Architettura

- `src/game/` — dinamica, logica gara, stato vetture, audio sintetizzato Web Audio.
- `src/editor/` — editor geometrico, viewport e storia undo/redo.
- `src/rendering/` — Canvas 2D, piste multilinea e auto miniatura.
- `src/input/` — tastiera, gamepad e pad analogici multitouch.
- `src/storage/` — circuiti e record in `localStorage`.
- `public/sw.js` — service worker per uso offline dopo una prima visita in rete.
- `.github/workflows/deploy.yml` — CI e rilascio su Pages.
- `tests/` — test automatici Vitest.

## Note e limiti

- Non c'è multiplayer su Internet: i piloti giocano sullo stesso schermo e dispositivo.
- Piste e record rimangono **solo nel browser** utilizzato, finché i dati del sito non vengono cancellati. Esporta le piste in JSON per salvarne una copia o condividerle.
- Il service worker memorizza il gioco e le risorse statiche durante la prima visita online (completata l’installazione del service worker). I successivi accessi sono disponibili anche offline; le nuove pubblicazioni sono rilevate con navigazione network-first.
- I suoni partono solo dopo un'interazione iniziale, in conformità alle restrizioni autoplay del browser.
- L'MVP punta a una grafica 2D leggera, non a fotorealismo o a una simulazione di contatti 3D.
