"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import {
  Users, GraduationCap, Play, Pause, RotateCcw, SkipForward,
  Shuffle, MessageCircle, Maximize2, Minimize2, Monitor, Settings
} from "lucide-react"

type Person = { name: string; isTeacher: boolean }
type Group = Person[]

export default function WorkshopApp() {
  const [studentsInput, setStudentsInput] = useState("")
  const [teachersInput, setTeachersInput] = useState("")
  const [groupingMode, setGroupingMode] = useState<"perGroup" | "totalGroups">("perGroup")
  const [groupSize, setGroupSize] = useState(4)
  const [totalGroupCount, setTotalGroupCount] = useState(3)
  const [numSets, setNumSets] = useState(2)
  const [talkTime, setTalkTime] = useState(15)
  const [themes, setThemes] = useState<string[]>(["", ""])
  const [allSetsGroups, setAllSetsGroups] = useState<Group[][]>([])
  const [currentSet, setCurrentSet] = useState(1)
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // Keyboard shortcuts (Space=再生/停止, →=次セット, R=リセット)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.code === "Space") {
        e.preventDefault()
        setIsRunning(prev => (timeLeft > 0 ? !prev : prev))
      }
      if (e.code === "ArrowRight") {
        if (currentSet < numSets && allSetsGroups.length > 0) {
          setCurrentSet(s => s + 1); setTimeLeft(talkTime * 60)
          setIsRunning(false); setIsFinished(false)
        }
      }
      if (e.code === "KeyR") {
        setIsRunning(false); setTimeLeft(talkTime * 60); setIsFinished(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [timeLeft, currentSet, numSets, allSetsGroups.length, talkTime])

  // numSets 変更時にテーマ配列を調整
  useEffect(() => {
    setThemes(prev => {
      const next = [...prev]
      while (next.length < numSets) next.push("")
      return next.slice(0, numSets)
    })
  }, [numSets])

  const parseNames = (input: string) =>
    input.split("\n").map(n => n.trim()).filter(n => n.length > 0)

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const createBalancedGroups = (students: string[], teachers: string[], numGroups: number): Group[] => {
    const groups: Group[] = Array.from({ length: numGroups }, () => [])
    teachers.forEach((t, i) => groups[i % numGroups].push({ name: t, isTeacher: true }))
    const shuffled = shuffleArray(students)
    const total = teachers.length + shuffled.length
    const base = Math.floor(total / numGroups)
    const extra = total % numGroups
    let si = 0
    for (let i = 0; i < numGroups && si < shuffled.length; i++) {
      const need = base + (i < extra ? 1 : 0) - groups[i].length
      for (let j = 0; j < need && si < shuffled.length; j++)
        groups[i].push({ name: shuffled[si++], isTeacher: false })
    }
    while (si < shuffled.length) {
      const min = groups.reduce((m, g, i) => g.length < groups[m].length ? i : m, 0)
      groups[min].push({ name: shuffled[si++], isTeacher: false })
    }
    return groups
  }

  const generateGroups = () => {
    const students = parseNames(studentsInput)
    const teachers = parseNames(teachersInput)
    if (students.length + teachers.length === 0) return
    const numGroups = groupingMode === "perGroup"
      ? Math.max(1, Math.ceil((students.length + teachers.length) / groupSize))
      : Math.max(1, totalGroupCount)
    const shuffledTeachers = shuffleArray(teachers)
    setAllSetsGroups(Array.from({ length: numSets }, () => createBalancedGroups(students, shuffledTeachers, numGroups)))
    setCurrentSet(1); setTimeLeft(talkTime * 60); setIsRunning(false); setIsFinished(false)
  }

  const playBeep = useCallback(() => {
    try {
      if (!audioContextRef.current)
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const ctx = audioContextRef.current
      const playTone = (t: number, f: number) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = f; osc.type = "sine"
        g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.8)
        osc.start(t); osc.stop(t + 0.8)
      }
      const now = ctx.currentTime
      for (let i = 0; i < 10; i++)
        [800, 1000, 1200].forEach((f, j) => playTone(now + i * 1.1 + j * 0.9, f))
    } catch { console.log("Audio not supported") }
  }, [])

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setIsRunning(false); setIsFinished(true); playBeep(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning, timeLeft, playBeep])

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  const goToSet = (n: number) => {
    setCurrentSet(n); setTimeLeft(talkTime * 60); setIsRunning(false); setIsFinished(false)
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  }

  const currentGroups = allSetsGroups[currentSet - 1] ?? []
  const currentTheme = themes[currentSet - 1] ?? ""

  const getThemeFontSize = (t: string) => {
    const l = t.length
    if (l <= 5) return "10rem"; if (l <= 10) return "8rem"
    if (l <= 20) return "6rem"; if (l <= 30) return "5rem"; return "4rem"
  }

  const getGroupHeaderSize = () => isPresentationMode ? "text-2xl" : "text-lg"

  const getBadgeSize = () => isPresentationMode ? "text-4xl py-2 px-3" : "text-3xl"

  const getGroupCardClass = (group: Group) => {
    const chars = group.reduce((s, p) => s + p.name.length, 0)
    if (isPresentationMode) {
      if (chars <= 8) return "text-5xl"; if (chars <= 12) return "text-4xl"
      if (chars <= 16) return "text-3xl"; return "text-2xl"
    }
    if (chars <= 10) return "text-4xl"; if (chars <= 15) return "text-3xl"
    if (chars <= 20) return "text-2xl"; if (chars <= 25) return "text-xl"
    return "text-lg"
  }

  const timerColorClass = isFinished ? "text-red-500" : timeLeft <= 60 ? "text-orange-500" : ""
  const timerFontSize = isPresentationMode ? "14rem" : "12rem"

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ワークショップ進行アプリ</h1>
          {/* セット進捗ドット */}
          {allSetsGroups.length > 0 && (
            <div className="flex items-center gap-1.5 ml-4">
              {Array.from({ length: numSets }, (_, i) => (
                <button
                  key={i}
                  onClick={() => goToSet(i + 1)}
                  title={`セット ${i + 1}${themes[i] ? `: ${themes[i]}` : ""}`}
                  className={`rounded-full transition-all duration-300 ${i + 1 === currentSet
                    ? "bg-primary w-7 h-3.5"
                    : i + 1 < currentSet
                      ? "bg-primary/50 w-3 h-3"
                      : "bg-muted-foreground/30 w-3 h-3"
                    }`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                {currentSet} / {numSets}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* キーボードショートカットヒント */}
          {isPresentationMode && (
            <span className="text-xs text-muted-foreground mr-2 hidden md:block">
              スペース: 再生/停止　→: 次セット　R: リセット
            </span>
          )}
          <Button
            variant={isPresentationMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPresentationMode(v => !v)}
            className="gap-1"
          >
            {isPresentationMode ? <Settings className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            {isPresentationMode ? "設定" : "授業モード"}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-2 p-4 overflow-hidden">

        {/* Left Column — 授業モードでは非表示 */}
        {!isPresentationMode && (
          <div className="w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
            <Card>
              <CardHeader className="py-1 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />参加者入力
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 space-y-2">
                <div>
                  <Label className="text-sm">学生（改行区切り）</Label>
                  <Textarea value={studentsInput} onChange={e => setStudentsInput(e.target.value)}
                    placeholder={"山田太郎\n佐藤花子\n..."} className="h-16 mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-sm">先生（改行区切り）</Label>
                  <Textarea value={teachersInput} onChange={e => setTeachersInput(e.target.value)}
                    placeholder={"田中先生\n鈴木先生\n..."} className="h-16 mt-1 text-xs" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-1 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shuffle className="h-4 w-4" />グループ設定
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 space-y-2">
                <RadioGroup value={groupingMode} onValueChange={v => setGroupingMode(v as "perGroup" | "totalGroups")} className="space-y-2">
                  <div className="flex items-center gap-2 h-8">
                    <RadioGroupItem value="perGroup" id="perGroup" />
                    <Label htmlFor="perGroup" className="text-sm">1グループあたりの人数</Label>
                    <Input type="number" min={2} value={groupSize} onChange={e => setGroupSize(Number(e.target.value))}
                      className="w-16 h-7 text-sm" disabled={groupingMode !== "perGroup"} />
                  </div>
                  <div className="flex items-center gap-2 h-8">
                    <RadioGroupItem value="totalGroups" id="totalGroups" />
                    <Label htmlFor="totalGroups" className="text-sm">グループ数</Label>
                    <Input type="number" min={1} value={totalGroupCount} onChange={e => setTotalGroupCount(Number(e.target.value))}
                      className="w-16 h-7 text-sm" disabled={groupingMode !== "totalGroups"} />
                  </div>
                </RadioGroup>
                <Button onClick={generateGroups} className="w-full">
                  <Shuffle className="h-4 w-4 mr-2" />グループ作成
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-1 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />トーク設定
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">時間（分）</Label>
                  <Input type="number" min={1} value={talkTime}
                    onChange={e => { const v = Number(e.target.value); setTalkTime(v); if (!isRunning) setTimeLeft(v * 60) }}
                    className="w-20 h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">セット数</Label>
                  <Input type="number" min={1} max={10} value={numSets}
                    onChange={e => setNumSets(Math.max(1, Math.min(10, Number(e.target.value))))}
                    className="w-20 h-8 text-sm" />
                </div>
                {themes.map((theme, i) => (
                  <div key={i}>
                    <Label className="text-sm">第{i + 1}セットのテーマ</Label>
                    <Textarea value={theme}
                      onChange={e => { const next = [...themes]; next[i] = e.target.value; setThemes(next) }}
                      placeholder={`例: テーマ${i + 1}`} className="mt-1 text-sm" rows={2} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Center Column — タイマー・コントロール・テーマ */}
        <div className={`${isPresentationMode ? "w-72 flex-shrink-0" : "flex-1"} flex flex-col`}>
          {/* タイマー */}
          <div className="flex-[0.9] flex items-center justify-center">
            <div
              className={`font-mono font-bold transition-colors duration-500 ${timerColorClass}`}
              style={{ fontSize: timerFontSize, lineHeight: 1 }}
            >
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* コントロール */}
          <div className="flex-shrink-0 flex justify-center items-center gap-2 py-2">
            {!isRunning ? (
              <Button onClick={() => { if (timeLeft > 0) setIsRunning(true) }}
                size={isPresentationMode ? "default" : "sm"} className="gap-1">
                <Play className="h-4 w-4" />スタート
              </Button>
            ) : (
              <Button onClick={() => setIsRunning(false)}
                size={isPresentationMode ? "default" : "sm"} variant="secondary" className="gap-1">
                <Pause className="h-4 w-4" />一時停止
              </Button>
            )}
            <Button onClick={() => { setIsRunning(false); setTimeLeft(talkTime * 60); setIsFinished(false) }}
              size={isPresentationMode ? "default" : "sm"} variant="outline" className="gap-1">
              <RotateCcw className="h-4 w-4" />リセット
            </Button>
            <Button onClick={() => { if (currentSet < numSets) goToSet(currentSet + 1) }}
              size={isPresentationMode ? "default" : "sm"} variant="outline"
              disabled={currentSet >= numSets} className="gap-1">
              <SkipForward className="h-4 w-4" />次のセット
            </Button>
          </div>

          {/* テーマ表示 */}
          <div className="flex-[2.5] flex items-center justify-center p-4 bg-primary text-primary-foreground rounded-lg">
            <p style={{ fontSize: getThemeFontSize(currentTheme), whiteSpace: "pre-wrap", fontWeight: "bold", lineHeight: 1.2, textAlign: "center" }}>
              {currentTheme || "テーマ未設定"}
            </p>
          </div>
        </div>

        {/* Right Column — グループ一覧 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-1 px-3 flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                グループ一覧（セット {currentSet}）
                <span className="text-xs text-muted-foreground">
                  学生: {currentGroups.reduce((s, g) => s + g.filter(p => !p.isTeacher).length, 0)}人 /
                  先生: {currentGroups.reduce((s, g) => s + g.filter(p => p.isTeacher).length, 0)}人
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2 flex-1 overflow-hidden">
              {currentGroups.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  参加者を入力して「グループ作成」を押してください
                </div>
              ) : (
                <div className={`grid gap-1.5 h-full ${currentGroups.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {currentGroups.map((group, gi) => (
                    <div key={gi}
                      className={`border-2 rounded-lg p-2 bg-card flex flex-col justify-center items-center text-center ${getGroupCardClass(group)}`}>
                      <h3 className={`font-bold mb-2 ${getGroupHeaderSize()}`}>
                        グループ {gi + 1}　<span className="text-muted-foreground text-base font-normal">({group.length}人)</span>
                      </h3>
                      <div className="flex flex-wrap justify-center gap-1">
                        {group.map((person, pi) => (
                          <Badge key={pi}
                            variant={person.isTeacher ? "default" : "secondary"}
                            className={`${getBadgeSize()} font-bold`}>
                            {person.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
