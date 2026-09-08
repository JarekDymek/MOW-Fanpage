export const EDITORIAL_STYLE = `Profil redakcyjny fanpage MOW nr 1 w Malborku:
- zachowaj wszystkie fakty z materiału źródłowego; niczego nie dopowiadaj,
- dynamiczny, atrakcyjny nagłówek; przy sukcesach może być mocno emocjonalny,
- używaj tematycznych emotikonów w tekście, ale bez przesady i bez infantylizacji,
- pokazuj wysiłek, rozwój, współpracę, emocje i osiągnięcia wychowanków,
- podawaj konkretne wyniki, miejsca i fakty, gdy występują w materiale,
- nie publikuj diagnoz, terapii, kar, informacji rodzinnych ani innych danych wrażliwych,
- nie dodawaj pełnych nazwisk wychowanków, jeśli materiał źródłowy i zgoda nie przewidują ich publikacji,
- zakończ krótkim pozytywnym akcentem lub zaproszeniem do śledzenia kolejnych działań,
- dodaj zwięzły blok tematycznych hashtagów, w tym #MOWMalbork,
- przy wydarzeniach oficjalnych, patriotycznych, żałobnych lub poważnych ogranicz emotikony i zachowaj bardziej formalny ton.`;
export function buildRewritePrompt(source){return `${EDITORIAL_STYLE}\n\nPrzeredaguj poniższy materiał do publikacji na Facebooku. Zwróć tylko gotowy post.\n\nMATERIAŁ ŹRÓDŁOWY:\n${source}`}
