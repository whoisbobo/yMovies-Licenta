// Limita de filme/seriale favorite per utilizator (gen "Favorite Films" pe Letterboxd).
export const FAVORITE_LIMIT = 4;

// Genurile standard TMDB (nume canonice EN) — pentru alegerea genurilor preferate.
export const MOVIE_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

// Câte genuri preferate poate alege un user.
export const FAVORITE_GENRES_LIMIT = 5;
