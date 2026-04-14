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
  Users, 
  GraduationCap, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Clock, 
  Shuffle,
  MessageCircle
} from "lucide-react"

type Person = {
  name: string
  isTeacher: boolean
}

type Group = Person[]

export default function WorkshopApp() {
  // Input state
  const [studentsInput, setStudentsInput] = useState("")
  const [teachersInput, setTeachersInput] = useState("")
  const [groupingMode, setGroupingMode] = useState<"perGroup" | "totalGroups">("perGroup")
  const [groupSize, setGroupSize] = useState(4)
  const [totalGroupCount, setTotalGroupCount] = useState(3)

  // Theme and time settings
  const [talkTime, setTalkTime] = useState(15)
  const [theme1, setTheme1] = useState("")
  const [theme2, setTheme2] = useState("")

  // Groups state
  const [set1Groups, setSet1Groups] = useState<Group[]>([])
  const [set2Groups, setSet2Groups] = useState<Group[]>([])
  const [currentSet, setCurrentSet] = useState(1)

  // Timer state
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  // Audio context ref
  const audioContextRef = useRef<AudioContext | null>(null)

  // Parse input names
  const parseNames = (input: string): string[] => {
    return input
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
  }

  // Shuffle array helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Create groups with balanced teacher distribution
  const createBalancedGroups = (students: string[], teachers: string[], numGroups: number): Group[] => {
    const groups: Group[] = Array.from({ length: numGroups }, () => [])
    
    // Shuffle teachers and distribute them first
    const shuffledTeachers = shuffleArray(teachers)
    shuffledTeachers.forEach((teacher, index) => {
      groups[index % numGroups].push({ name: teacher, isTeacher: true })
    })

    // Shuffle students and distribute them
    const shuffledStudents = shuffleArray(students)
    let studentIndex = 0
    
    // Fill groups as evenly as possible
    const totalPeople = shuffledTeachers.length + shuffledStudents.length
    const baseSize = Math.floor(totalPeople / numGroups)
    const extraPeople = totalPeople % numGroups

    for (let i = 0; i < numGroups && studentIndex < shuffledStudents.length; i++) {
      const currentGroupSize = groups[i].length
      const targetSize = baseSize + (i < extraPeople ? 1 : 0)
      const studentsNeeded = targetSize - currentGroupSize

      for (let j = 0; j < studentsNeeded && studentIndex < shuffledStudents.length; j++) {
        groups[i].push({ name: shuffledStudents[studentIndex], isTeacher: false })
        studentIndex++
      }
    }

    // Distribute any remaining students
    while (studentIndex < shuffledStudents.length) {
      const smallestGroup = groups.reduce((min, group, idx) => 
        group.length < groups[min].length ? idx : min
      , 0)
      groups[smallestGroup].push({ name: shuffledStudents[studentIndex], isTeacher: false })
      studentIndex++
    }

    return groups
  }

  // Generate both sets of groups
  const generateGroups = () => {
    const students = parseNames(studentsInput)
    const teachers = parseNames(teachersInput)
    const totalPeople = students.length + teachers.length

    if (totalPeople === 0) return

    let numGroups: number
    if (groupingMode === "perGroup") {
      numGroups = Math.max(1, Math.ceil(totalPeople / groupSize))
    } else {
      numGroups = Math.max(1, totalGroupCount)
    }

    // Generate Set 1
    const groups1 = createBalancedGroups(students, teachers, numGroups)
    setSet1Groups(groups1)

    // Generate Set 2 with different combinations
    const groups2 = createBalancedGroups(students, teachers, numGroups)
    setSet2Groups(groups2)

    // Reset to Set 1
    setCurrentSet(1)
    setTimeLeft(talkTime * 60)
    setIsRunning(false)
    setIsFinished(false)
  }

  // Play beep sound
  const playBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      
      // Play 3 beeps
      const playTone = (startTime: number) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = 800
        oscillator.type = "sine"
        
        gainNode.gain.setValueAtTime(0.5, startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.3)
      }

      const now = ctx.currentTime
      playTone(now)
      playTone(now + 0.4)
      playTone(now + 0.8)
    } catch {
      console.log("Audio not supported")
    }
  }, [])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            setIsFinished(true)
            playBeep()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeLeft, playBeep])

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Timer controls
  const startTimer = () => {
    if (timeLeft > 0) setIsRunning(true)
  }
  const pauseTimer = () => setIsRunning(false)
  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(talkTime * 60)
    setIsFinished(false)
  }
  const goToNextSet = () => {
    if (currentSet === 1) {
      setCurrentSet(2)
      setTimeLeft(talkTime * 60)
      setIsRunning(false)
      setIsFinished(false)
    }
  }

  // Current groups and theme
  const currentGroups = currentSet === 1 ? set1Groups : set2Groups
  const currentTheme = currentSet === 1 ? theme1 : theme2

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ワークショップ進行アプリ</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Left Column - Settings */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Participants Input */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                参加者入力
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="text-sm">学生（改行区切り）</Label>
                <Textarea
                  value={studentsInput}
                  onChange={(e) => setStudentsInput(e.target.value)}
                  placeholder="山田太郎&#10;佐藤花子&#10;..."
                  className="h-20 mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">先生（改行区切り）</Label>
                <Textarea
                  value={teachersInput}
                  onChange={(e) => setTeachersInput(e.target.value)}
                  placeholder="田中先生&#10;鈴木先生&#10;..."
                  className="h-20 mt-1 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Group Settings */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Shuffle className="h-4 w-4" />
                グループ設定
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <RadioGroup
                value={groupingMode}
                onValueChange={(v) => setGroupingMode(v as "perGroup" | "totalGroups")}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="perGroup" id="perGroup" />
                  <Label htmlFor="perGroup" className="text-sm">1グループあたりの人数</Label>
                  <Input
                    type="number"
                    min={2}
                    value={groupSize}
                    onChange={(e) => setGroupSize(Number(e.target.value))}
                    className="w-16 h-8 text-sm"
                    disabled={groupingMode !== "perGroup"}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="totalGroups" id="totalGroups" />
                  <Label htmlFor="totalGroups" className="text-sm">グループ数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={totalGroupCount}
                    onChange={(e) => setTotalGroupCount(Number(e.target.value))}
                    className="w-16 h-8 text-sm"
                    disabled={groupingMode !== "totalGroups"}
                  />
                </div>
              </RadioGroup>
              <Button onClick={generateGroups} className="w-full">
                <Shuffle className="h-4 w-4 mr-2" />
                グループ作成
              </Button>
            </CardContent>
          </Card>

          {/* Talk Settings */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                トーク設定
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">時間（分）</Label>
                <Input
                  type="number"
                  min={1}
                  value={talkTime}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setTalkTime(val)
                    if (!isRunning) setTimeLeft(val * 60)
                  }}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">第1セットのテーマ</Label>
                <Input
                  value={theme1}
                  onChange={(e) => setTheme1(e.target.value)}
                  placeholder="例: 自己紹介"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">第2セットのテーマ</Label>
                <Input
                  value={theme2}
                  onChange={(e) => setTheme2(e.target.value)}
                  placeholder="例: 将来の夢"
                  className="mt-1 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Timer & Dashboard */}
        <div className="flex flex-col gap-4">
          {/* Timer Card */}
          <Card className={`flex-shrink-0 ${isFinished ? "ring-2 ring-destructive animate-pulse" : ""}`}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  タイマー
                </span>
                <Badge variant={currentSet === 1 ? "default" : "secondary"}>
                  セット {currentSet}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Timer Display */}
              <div className="text-center mb-4">
                <div className={`text-6xl font-mono font-bold ${isFinished ? "text-destructive" : timeLeft <= 60 ? "text-orange-500" : ""}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-2 flex-wrap">
                {!isRunning ? (
                  <Button onClick={startTimer} size="sm" className="gap-1">
                    <Play className="h-4 w-4" />
                    スタート
                  </Button>
                ) : (
                  <Button onClick={pauseTimer} size="sm" variant="secondary" className="gap-1">
                    <Pause className="h-4 w-4" />
                    一時停止
                  </Button>
                )}
                <Button onClick={resetTimer} size="sm" variant="outline" className="gap-1">
                  <RotateCcw className="h-4 w-4" />
                  リセット
                </Button>
                <Button 
                  onClick={goToNextSet} 
                  size="sm" 
                  variant="outline"
                  disabled={currentSet === 2}
                  className="gap-1"
                >
                  <SkipForward className="h-4 w-4" />
                  次のセット
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Theme */}
          <Card className="flex-shrink-0 bg-primary text-primary-foreground">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">現在のトークテーマ</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-center">
                {currentTheme || "テーマ未設定"}
              </p>
            </CardContent>
          </Card>

          {/* Stats */}
          {currentGroups.length > 0 && (
            <Card className="flex-shrink-0">
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">グループ数</p>
                    <p className="text-xl font-bold">{currentGroups.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">学生</p>
                    <p className="text-xl font-bold">
                      {currentGroups.reduce((sum, g) => sum + g.filter(p => !p.isTeacher).length, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">先生</p>
                    <p className="text-xl font-bold">
                      {currentGroups.reduce((sum, g) => sum + g.filter(p => p.isTeacher).length, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Groups Display */}
        <div className="flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 flex-shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                グループ一覧（セット {currentSet}）
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex-1 overflow-y-auto">
              {currentGroups.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  参加者を入力して「グループ作成」を押してください
                </div>
              ) : (
                <div className="grid gap-3">
                  {currentGroups.map((group, groupIndex) => (
                    <div
                      key={groupIndex}
                      className="border rounded-lg p-3 bg-card"
                    >
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">
                          {groupIndex + 1}
                        </span>
                        グループ {groupIndex + 1}
                        <span className="text-muted-foreground font-normal">
                          ({group.length}人)
                        </span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {group.map((person, personIndex) => (
                          <Badge
                            key={personIndex}
                            variant={person.isTeacher ? "default" : "secondary"}
                            className="flex items-center gap-1 text-xs"
                          >
                            {person.isTeacher ? (
                              <GraduationCap className="h-3 w-3" />
                            ) : (
                              <Users className="h-3 w-3" />
                            )}
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
