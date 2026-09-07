# MOW Fanpage

Mobilna aplikacja PWA do bezpiecznego przekazywania materiałów na oficjalny fanpage Młodzieżowego Ośrodka Wychowawczego nr 1 im. Tadeusza Kościuszki w Malborku.

## Co potrafi

- instalacja jako PWA na Androidzie/iOS,
- logowanie pracowników,
- role `employee` i `moderator`,
- formularz materiału: opis + maks. 15 zdjęć,
- kompresja zdjęć w przeglądarce i ponowne kodowanie JPEG (usuwa typowe metadane EXIF/GPS z przesyłanej kopii),
- prywatny magazyn zdjęć w Supabase Storage,
- status wizerunku/zgód i wymagane oświadczenia,
- wybór: zachować tekst autora albo przekazać do redakcji,
- moderator może przygotować wersję redakcyjną i przesłać ją autorowi do akceptacji,
- autor może zaakceptować wersję albo poprosić o poprawkę,
- historia wersji i akceptacji,
- moderator oznacza publikację i zapisuje link do posta,
- przygotowana infrastruktura Web Push / Edge Function do powiadomień.

## Statusy

- `draft` – szkic,
- `submitted` – nowe zgłoszenie,
- `editing` – w redakcji,
- `awaiting_author` – czeka na autora,
- `changes_requested` – autor poprosił o zmianę,
- `approved` – zaakceptowane do publikacji,
- `published` – opublikowane,
- `rejected` – wstrzymane.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env
npm run dev
```

Uzupełnij `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

## Supabase

1. Utwórz projekt Supabase.
2. W SQL Editor uruchom `supabase/migrations/001_init.sql`.
3. Utwórz pierwsze konto moderatora w Authentication.
4. W tabeli `profiles` ustaw temu użytkownikowi `role = 'moderator'`.
5. Bucket `mow-materials` jest tworzony przez migrację jako prywatny.
6. Skonfiguruj Edge Function `notify-workflow` i zmienne Web Push, jeśli chcesz powiadomienia push.

### Bezpieczeństwo

RLS ogranicza pracowników do własnych zgłoszeń. Moderator ma dostęp do całego procesu redakcyjnego. Zdjęcia nie są publiczne; aplikacja generuje czasowe signed URL wyłącznie dla uprawnionego użytkownika.

## Deploy

Frontend jest przygotowany pod Vercel:

```bash
npm run build
```

Po podłączeniu repo do Vercel ustaw zmienne `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` oraz opcjonalnie `VITE_VAPID_PUBLIC_KEY`.

## Ważne organizacyjnie

Kod nie zastępuje procedur MOW dotyczących zgód na wizerunek, retencji zdjęć ani decyzji Administratora/IOD. System wymusza i dokumentuje określony obieg materiału.
