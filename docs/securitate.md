# Securitatea aplicației yMovies

Document care rezumă măsurile de securitate implementate în aplicație și
limitările cunoscute, identificate în urma unui audit de securitate al codului.

## 1. Măsuri de securitate implementate

### 1.1. Autentificare și autorizare
- **Autentificarea** este gestionată de **Clerk**, un serviciu specializat de
  identitate (sesiuni securizate, hashing de parole, protecție împotriva
  atacurilor de tip brute-force). Aplicația nu stochează și nu manipulează direct
  parole.
- **Toate acțiunile care modifică date** (Server Actions) verifică pe server
  identitatea apelantului prin `auth()` înainte de orice operație.
- **Identificatorul utilizatorului** (`userId`) este preluat întotdeauna din
  sesiunea server-side, niciodată din datele trimise de client. Astfel se previne
  clasa de vulnerabilități **IDOR** (Insecure Direct Object Reference) — un
  utilizator nu poate modifica resursele altuia.
- Ștergerea recenziilor și a comentariilor este permisă doar **autorului**,
  **proprietarului recenziei** (moderare) sau unui **administrator**.

### 1.2. Control de acces bazat pe roluri (RBAC)
- Panoul de administrare și toate acțiunile sale (schimbare rol, acordare premium,
  moderare recenzii) sunt protejate server-side de funcția `assertAdmin()`, care
  verifică rolul `ADMIN` în baza de date.
- Un administrator nu se poate retrograda pe sine (pentru a evita blocarea
  accidentală a accesului la panou).

### 1.3. Validarea datelor de intrare
- Toate datele primite de la client sunt validate cu **Zod** (tipuri, lungimi,
  intervale) înainte de a fi folosite.
- Adresa de website din profil este validată strict la formatul `http(s)://`,
  prevenind injectarea de scheme periculoase (ex. `javascript:`).

### 1.4. Protecție împotriva injecției și a execuției de cod
- **SQL Injection**: accesul la baza de date se face exclusiv prin **Prisma ORM**,
  care parametrizează automat toate interogările. Nu există interogări SQL brute.
- **Execuție de cod (RCE)**: codul nu folosește `eval`, `new Function` sau module
  de sistem (`child_process`).

### 1.5. Protecție împotriva XSS
- Nu se folosește `dangerouslySetInnerHTML` nicăieri în aplicație.
- **React** escapează automat tot conținutul generat de utilizatori (biografii,
  recenzii, comentarii, nume), neutralizând injecția de scripturi.

### 1.6. Rate limiting
- Acțiunile sensibile (recenzii, note, like-uri, follow, comentarii, checkout,
  sugestii de căutare) sunt limitate ca frecvență folosind **Upstash Redis**,
  pentru a preveni abuzul și spam-ul.

### 1.7. Securitatea webhook-urilor și a job-urilor programate
- Webhook-urile **Stripe** (plăți) și **Clerk** (sincronizare utilizatori)
  verifică **semnătura criptografică** a fiecărei cereri, respingând cererile
  nesemnate sau falsificate.
- Job-ul programat (cron) de sincronizare a datelor este protejat printr-un secret
  (`CRON_SECRET`) transmis în antetul `Authorization`.

### 1.8. Protecția secretelor
- Cheile API și secretele sunt stocate în variabile de mediu (`.env`), fișier
  exclus din controlul de versiune (`.gitignore`).
- Niciun secret non-public nu ajunge în codul care rulează în browser; cheile
  TMDB, Stripe și baza de date sunt folosite exclusiv pe server.
- Adresa de email a utilizatorilor este expusă doar în panoul de administrare
  (accesibil exclusiv administratorilor).

### 1.9. Protecție CSRF și antete de securitate
- **Server Actions** din Next.js includ protecție **CSRF** nativă (verificarea
  originii cererii).
- Aplicația trimite antete de securitate HTTP pe toate rutele:
  - `X-Frame-Options: DENY` (protecție împotriva clickjacking-ului)
  - `X-Content-Type-Options: nosniff` (împotriva MIME-sniffing-ului)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (dezactivează camera, microfonul, geolocația)

## 2. Limitări cunoscute și dezvoltări viitoare

Următoarele aspecte au fost identificate în timpul auditului. Niciunul nu
reprezintă o vulnerabilitate exploatabilă în contextul actual al aplicației, dar
sunt documentate pentru transparență și ca posibile îmbunătățiri viitoare.

1. **Vulnerabilități în dependințe tranzitive.** Utilitarul `npm audit`
   semnalează 4 vulnerabilități de severitate „moderată", toate provenind dintr-o
   dependință tranzitivă (**PostCSS**) a framework-ului Next.js. Problema se
   manifestă la **compilarea** stilurilor CSS, nu la runtime cu date furnizate de
   utilizatori, deci **nu este exploatabilă** în această aplicație. La momentul
   scrierii nu exista o versiune corectată disponibilă fără un upgrade major de
   Next.js.

2. **Absența unei politici Content-Security-Policy (CSP).** Un CSP ar oferi un
   nivel suplimentar de protecție (defense-in-depth) împotriva XSS. Dat fiind că
   riscul de XSS este deja minim (escaping automat React, fără `innerHTML`), iar
   configurarea unui CSP strict împreună cu Clerk, Stripe și TMDB este complexă,
   această măsură a fost lăsată ca dezvoltare viitoare.

3. **Construirea URL-urilor de redirect din antetul `Host`.** URL-urile de succes
   și anulare pentru checkout-ul Stripe sunt construite din antetul `Host` al
   cererii. Teoretic acest lucru ar putea permite un open-redirect, însă atacul
   **nu este exploatabil împotriva altor utilizatori** (un atacator ar putea seta
   doar propriul URL, redirecționându-se pe sine), iar platforma de găzduire
   (Vercel) validează antetul `Host`. O îmbunătățire ar fi fixarea domeniului
   printr-o variabilă de mediu dedicată.

4. **Gestionare mixtă a stării premium.** Statusul premium poate fi setat atât
   automat (prin Stripe) cât și manual (de un administrator). Pentru a evita
   desincronizarea, modificarea manuală este **blocată** pentru conturile
   gestionate de Stripe.

## 3. Concluzie

În urma auditului nu au fost identificate vulnerabilități de securitate
exploatabile. Aplicația implementează măsurile de securitate esențiale pentru o
aplicație web modernă (autentificare delegată, autorizare, validare, protecție
împotriva injecției și XSS, rate limiting, antete de securitate). Limitările
rămase sunt fie inerente ecosistemului (dependințe), fie măsuri opționale de
tip defense-in-depth, documentate ca direcții de dezvoltare viitoare.
