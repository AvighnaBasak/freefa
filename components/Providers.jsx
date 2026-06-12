'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getWCGames, getWCTeams, getWCGroups, getWCStadiums, getWC2026LiveScores, applyLiveScores, matchStatus } from '@/utils/api'
import MatchDetail from './MatchDetail'

const WCCtx = createContext(null)
export const useWC = () => useContext(WCCtx)

export default function Providers({ children }) {
  const [teams, setTeams]     = useState([])
  const [games, setGames]     = useState([])
  const [teamsMap, setTeamsMap] = useState({})
  const [groups, setGroups]   = useState([])
  const [standingsMap, setStandingsMap] = useState({})
  const [stadiumsMap, setStadiumsMap]   = useState({})
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    try {
      const [t, g, gr, st, live] = await Promise.all([
        getWCTeams(), getWCGames(), getWCGroups(), getWCStadiums(),
        getWC2026LiveScores().catch(() => new Map()),
      ])
      setTeams(t)
      const m = {}
      t.forEach(tm => { m[tm.id] = tm })
      setTeamsMap(m)
      // Overlay accurate live scores/status (TheSportsDB) on the schedule
      setGames(applyLiveScores(g, m, live))
      setGroups(gr)
      const sm = {}
      gr.forEach(group => {
        (group.teams ?? []).forEach(row => { sm[row.team_id] = { ...row, group: group.name } })
      })
      setStandingsMap(sm)
      const stm = {}
      st.forEach(s => { stm[s.id] = s })
      setStadiumsMap(stm)
    } catch (e) {
      console.error('WC data:', e)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  const liveCount = games.filter(g => matchStatus(g) === 'live').length

  return (
    <WCCtx.Provider value={{ teams, games, teamsMap, groups, standingsMap, stadiumsMap, selected, setSelected, liveCount, reload: load }}>
      {children}
      {selected && <MatchDetail game={selected} onClose={() => setSelected(null)} />}
    </WCCtx.Provider>
  )
}
