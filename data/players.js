// Notable squad players per team (roster facts only — tournament goal/assist
// counts are computed live from the games API, never hardcoded here).
export const TEAM_PLAYERS = {
  AR: [
    { name: 'Lionel Messi',      pos: 'FW', num: 10, wiki: 'Lionel_Messi' },
    { name: 'Lautaro Martínez',  pos: 'FW', num: 9,  wiki: 'Lautaro_Martínez' },
    { name: 'Julián Álvarez',    pos: 'FW', num: 19, wiki: 'Julián_Álvarez_(footballer)' },
  ],
  BR: [
    { name: 'Vinicius Jr.',      pos: 'FW', num: 7,  wiki: 'Vinícius_Júnior' },
    { name: 'Rodrygo',           pos: 'FW', num: 11, wiki: 'Rodrygo' },
    { name: 'Raphinha',          pos: 'FW', num: 10, wiki: 'Raphinha_(footballer)' },
  ],
  FR: [
    { name: 'Kylian Mbappé',     pos: 'FW', num: 10, wiki: 'Kylian_Mbappé' },
    { name: 'Antoine Griezmann', pos: 'FW', num: 7,  wiki: 'Antoine_Griezmann' },
    { name: 'Ousmane Dembélé',   pos: 'FW', num: 11, wiki: 'Ousmane_Dembélé' },
  ],
  PT: [
    { name: 'Cristiano Ronaldo', pos: 'FW', num: 7,  wiki: 'Cristiano_Ronaldo' },
    { name: 'Bruno Fernandes',   pos: 'MF', num: 8,  wiki: 'Bruno_Fernandes_(footballer,_born_1994)' },
    { name: 'Rafael Leão',       pos: 'FW', num: 11, wiki: 'Rafael_Leão' },
  ],
  ES: [
    { name: 'Lamine Yamal',      pos: 'FW', num: 19, wiki: 'Lamine_Yamal' },
    { name: 'Pedri',             pos: 'MF', num: 8,  wiki: 'Pedri' },
    { name: 'Álvaro Morata',     pos: 'FW', num: 9,  wiki: 'Álvaro_Morata' },
  ],
  DE: [
    { name: 'Florian Wirtz',     pos: 'MF', num: 10, wiki: 'Florian_Wirtz' },
    { name: 'Jamal Musiala',     pos: 'MF', num: 14, wiki: 'Jamal_Musiala' },
    { name: 'Kai Havertz',       pos: 'FW', num: 7,  wiki: 'Kai_Havertz' },
  ],
  GB: [
    { name: 'Jude Bellingham',   pos: 'MF', num: 10, wiki: 'Jude_Bellingham' },
    { name: 'Harry Kane',        pos: 'FW', num: 9,  wiki: 'Harry_Kane' },
    { name: 'Phil Foden',        pos: 'MF', num: 11, wiki: 'Phil_Foden' },
  ],
  MX: [
    { name: 'Hirving Lozano',    pos: 'FW', num: 22, wiki: 'Hirving_Lozano' },
    { name: 'Henry Martín',      pos: 'FW', num: 9,  wiki: 'Henry_Martín' },
    { name: 'Edson Álvarez',     pos: 'MF', num: 18, wiki: 'Edson_Álvarez' },
  ],
  US: [
    { name: 'Christian Pulisic', pos: 'MF', num: 10, wiki: 'Christian_Pulisic' },
    { name: 'Gio Reyna',         pos: 'MF', num: 7,  wiki: 'Giovanni_Reyna' },
    { name: 'Tim Weah',          pos: 'FW', num: 21, wiki: 'Timothy_Weah' },
  ],
  CA: [
    { name: 'Alphonso Davies',   pos: 'DF', num: 3,  wiki: 'Alphonso_Davies' },
    { name: 'Jonathan David',    pos: 'FW', num: 9,  wiki: 'Jonathan_David_(footballer)' },
    { name: 'Cyle Larin',        pos: 'FW', num: 17, wiki: 'Cyle_Larin' },
  ],
  NL: [
    { name: 'Virgil van Dijk',   pos: 'DF', num: 4,  wiki: 'Virgil_van_Dijk' },
    { name: 'Xavi Simons',       pos: 'MF', num: 10, wiki: 'Xavi_Simons' },
  ],
  BE: [
    { name: 'Kevin De Bruyne',   pos: 'MF', num: 7,  wiki: 'Kevin_De_Bruyne' },
    { name: 'Romelu Lukaku',     pos: 'FW', num: 9,  wiki: 'Romelu_Lukaku' },
  ],
  JP: [
    { name: 'Kaoru Mitoma',      pos: 'FW', num: 11, wiki: 'Kaoru_Mitoma' },
    { name: 'Takumi Minamino',   pos: 'MF', num: 10, wiki: 'Takumi_Minamino' },
  ],
  MA: [
    { name: 'Achraf Hakimi',     pos: 'DF', num: 2,  wiki: 'Achraf_Hakimi' },
    { name: 'Hakim Ziyech',      pos: 'MF', num: 7,  wiki: 'Hakim_Ziyech' },
  ],
  HR: [
    { name: 'Luka Modrić',       pos: 'MF', num: 10, wiki: 'Luka_Modrić' },
    { name: 'Ivan Perišić',      pos: 'FW', num: 4,  wiki: 'Ivan_Perišić' },
  ],
  UY: [
    { name: 'Darwin Núñez',      pos: 'FW', num: 11, wiki: 'Darwin_Núñez' },
    { name: 'Federico Valverde', pos: 'MF', num: 8,  wiki: 'Federico_Valverde' },
  ],
  SN: [
    { name: 'Sadio Mané',        pos: 'FW', num: 10, wiki: 'Sadio_Mané' },
    { name: 'Kalidou Koulibaly', pos: 'DF', num: 3,  wiki: 'Kalidou_Koulibaly' },
  ],
  CM: [
    { name: 'André Onana',       pos: 'GK', num: 1,  wiki: 'André_Onana' },
    { name: 'Eric Maxim Choupo-Moting', pos: 'FW', num: 13, wiki: 'Eric_Maxim_Choupo-Moting' },
  ],
  GH: [
    { name: 'Jordan Ayew',       pos: 'FW', num: 9,  wiki: 'Jordan_Ayew' },
    { name: 'Thomas Partey',     pos: 'MF', num: 5,  wiki: 'Thomas_Partey' },
  ],
  KR: [
    { name: 'Son Heung-min',     pos: 'FW', num: 7,  wiki: 'Son_Heung-min' },
    { name: 'Lee Kang-in',       pos: 'MF', num: 11, wiki: 'Lee_Kang-in' },
  ],
  AU: [
    { name: 'Mathew Ryan',       pos: 'GK', num: 1,  wiki: 'Mathew_Ryan' },
    { name: 'Mitchell Duke',     pos: 'FW', num: 19, wiki: 'Mitchell_Duke' },
  ],
}

export function getPlayersForTeam(iso2) {
  if (!iso2) return []
  const key = iso2.toUpperCase().split('-')[0]
  return TEAM_PLAYERS[key] ?? []
}

export function getStarPlayer(iso2) {
  return getPlayersForTeam(iso2)[0] ?? null
}
