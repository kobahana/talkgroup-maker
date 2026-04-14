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
    
    // Distribute teachers in order (not shuffled)
    teachers.forEach((teacher, index) => {
      groups[index % numGroups].push({ name: teacher, isTeacher: true })
    })

    // Shuffle students and distribute them
    const shuffledStudents = shuffleArray(students)
    let studentIndex = 0
    
    // Fill groups as evenly as possible
    const totalPeople = teachers.length + shuffledStudents.length
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

    // Shuffle teachers once for consistent placement across sets
    const shuffledTeachers = shuffleArray(teachers)

    // Generate Set 1
    const groups1 = createBalancedGroups(students, shuffledTeachers, numGroups)
    setSet1Groups(groups1)

    // Generate Set 2 with different combinations but same teacher positions
    const groups2 = createBalancedGroups(students, shuffledTeachers, numGroups)
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
      
      // Play melody
      const playTone = (startTime: number, frequency: number) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = frequency
        oscillator.type = "sine"
        
        gainNode.gain.setValueAtTime(0.3, startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.8)
      }

      const now = ctx.currentTime
      const melody = [800, 1000, 1200]
      for (let i = 0; i < 10; i++) {  // Repeat 10 times for ~10x longer
        melody.forEach((freq, index) => {
          playTone(now + i * 1.1 + index * 0.9, freq)
        })
      }
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

  // Get theme font class based on length
  const getThemeClass = (theme: string) => {
    const len = theme.length;
    if (len <= 5) return "text-9xl font-bold";
    if (len <= 10) return "text-7xl font-bold";
    if (len <= 20) return "text-5xl font-bold";
    return "text-4xl font-bold";
  }

  // Get theme font size in rem for larger display
  const getThemeFontSize = (theme: string) => {
    const len = theme.length;
    if (len <= 5) return "10rem";
    if (len <= 10) return "8rem";
    if (len <= 20) return "6rem";
    if (len <= 30) return "5rem";
    return "4rem";
  }

  // Get group font class based on total characters
  const getGroupClass = (group: Group) => {
    const totalChars = group.reduce((sum, person) => sum + person.name.length, 0) + `グループ ${group.length}人`.length;
    if (totalChars <= 10) return "text-5xl";
    if (totalChars <= 15) return "text-4xl";
    if (totalChars <= 20) return "text-3xl";
    if (totalChars <= 25) return "text-2xl";
    if (totalChars <= 30) return "text-xl";
    return "text-lg";
  }

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
      <div className="flex-1 flex gap-2 p-4 overflow-hidden">
        {/* Left Column - Settings */}
        <div className="w-80 flex flex-col gap-2 overflow-y-auto">
          {/* Participants Input */}
          <Card>
            <CardHeader className="py-1 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                参加者入力
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 space-y-2">
              <div>
                <Label className="text-sm">学生（改行区切り）</Label>
                <Textarea
                  value={studentsInput}
                  onChange={(e) => setStudentsInput(e.target.value)}
                  placeholder="山田太郎&#10;佐藤花子&#10;..."
                  className="h-16 mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-sm">先生（改行区切り）</Label>
                <Textarea
                  value={teachersInput}
                  onChange={(e) => setTeachersInput(e.target.value)}
                  placeholder="田中先生&#10;鈴木先生&#10;..."
                  className="h-16 mt-1 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Group Settings */}
          <Card>
            <CardHeader className="py-1 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shuffle className="h-4 w-4" />
                グループ設定
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 space-y-2">
              <RadioGroup
                value={groupingMode}
                onValueChange={(v) => setGroupingMode(v as "perGroup" | "totalGroups")}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 h-8">
                  <RadioGroupItem value="perGroup" id="perGroup" />
                  <Label htmlFor="perGroup" className="text-sm">1グループあたりの人数</Label>
                  <Input
                    type="number"
                    min={2}
                    value={groupSize}
                    onChange={(e) => setGroupSize(Number(e.target.value))}
                    className="w-16 h-7 text-sm"
                    disabled={groupingMode !== "perGroup"}
                  />
                </div>
                <div className="flex items-center gap-2 h-8">
                  <RadioGroupItem value="totalGroups" id="totalGroups" />
                  <Label htmlFor="totalGroups" className="text-sm">グループ数</Label>
                  <Input
                    type="number"
                    min={1}
                    value={totalGroupCount}
                    onChange={(e) => setTotalGroupCount(Number(e.target.value))}
                    className="w-16 h-7 text-sm"
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
            <CardHeader className="py-1 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                トーク設定
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 space-y-2">
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
                <Textarea
                  value={theme1}
                  onChange={(e) => setTheme1(e.target.value)}
                  placeholder="例: 自己紹介&#10;将来の夢"
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm">第2セットのテーマ</Label>
                <Textarea
                  value={theme2}
                  onChange={(e) => setTheme2(e.target.value)}
                  placeholder="例: 好きな食べ物&#10;趣味"
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Timer & Theme */}
        <div className="flex-1 flex flex-col">
          {/* Timer Section */}
          <div className="flex-[0.8] flex items-center justify-center p-4">
            <div 
              className={`font-mono font-bold ${isFinished ? "text-destructive" : timeLeft <= 60 ? "text-orange-500" : ""}`}
              style={{ fontSize: "12rem", lineHeight: "1" }}
            >
              {formatTime(timeLeft)}
            </div>
          </div>
          
          {/* Controls Section */}
          <div className="flex-[0.5] flex justify-center items-center gap-2 p-2">
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
          
          {/* Theme Section */}
          <div className="flex-[3] flex items-center justify-center p-4 bg-primary text-primary-foreground">
            <p style={{ fontSize: getThemeFontSize(currentTheme), whiteSpace: 'pre-wrap', textAlign: 'left', fontWeight: 'bold', lineHeight: '1.2' }}>
              {currentTheme || "テーマ未設定"}
            </p>
          </div>
        </div>

        {/* Right Column - Groups Display */}
        <div className="w-[36rem] flex flex-col overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-1 px-3 flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                グループ一覧（セット {currentSet}）
                <span className="text-xs text-muted-foreground">
                  学生: {currentGroups.reduce((sum, g) => sum + g.filter(p => !p.isTeacher).length, 0)}人 / 
                  先生: {currentGroups.reduce((sum, g) => sum + g.filter(p => p.isTeacher).length, 0)}人
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2 flex-1 overflow-hidden">
              {currentGroups.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  参加者を入力して「グループ作成」を押してください
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 h-full">
                  {currentGroups.map((group, groupIndex) => (
                    <div
                      key={groupIndex}
                      className={`border rounded p-1 bg-card flex flex-col justify-center items-center text-center ${getGroupClass(group)}`}
                    >
                      <h3 className="font-bold mb-1 text-lg">
                        グループ {groupIndex + 1} ({group.length}人)
                      </h3>
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {group.map((person, personIndex) => (
                          <Badge
                            key={personIndex}
                            variant={person.isTeacher ? "default" : "secondary"}
                            className="flex items-center gap-1 text-3xl"
                          >
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
