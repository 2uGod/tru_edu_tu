'use client'

import { supabase } from '@/utils/supabase'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Question = {
  question: string
  choices: string[]
  answer_index: number
  hint: string
}

type Story = {
  id: string
  title: string
  lines: string[]
  question: string
  choices: string[]
  answer_index: number
  order_items: string[]
  questions?: Question[]
}

type Profile = {
  id: string
  role: 'parent' | 'child'
  name: string
}

type Reader = 'ai' | 'child'
type Step = 'today' | 'reading' | 'question' | 'complete'

type DashboardAnswer = {
  id: string
  selected_index: number
  is_correct: boolean
  attempt_count: number
  created_at: string
  stories?: { title?: string } | { title?: string }[] | null
}

const getReader = (index: number): Reader => (index % 2 === 0 ? 'ai' : 'child')
const getReaderLabel = (reader: Reader) => (reader === 'ai' ? 'AI 선생님' : '아이')
const getReaderTurnText = (reader: Reader) =>
  reader === 'ai' ? 'AI 선생님이 읽을 차례' : '아이가 읽을 차례'

const getStoryQuestions = (story?: Story): Question[] => {
  if (!story) return []

  if (Array.isArray(story.questions) && story.questions.length > 0) {
    return story.questions.slice(0, 4)
  }

  const lines = story.lines
  return [
    {
      question: story.question,
      choices: story.choices,
      answer_index: story.answer_index,
      hint: '이야기에서 장소나 행동이 나온 문장을 다시 떠올려 보세요.',
    },
    {
      question: '이야기의 처음에는 어떤 일이 있었나요?',
      choices: [lines[0] ?? '처음 장면', lines[1] ?? '두 번째 장면', lines[2] ?? '세 번째 장면', '이야기에 나오지 않은 일'],
      answer_index: 0,
      hint: '첫 번째 문장을 다시 떠올려 보세요.',
    },
    {
      question: '이야기의 중간에 나온 중요한 도움이나 단서는 무엇인가요?',
      choices: [lines[2] ?? story.choices[story.answer_index], lines[0] ?? story.choices[0], lines[lines.length - 1] ?? story.choices[1], '아무 일도 일어나지 않았어요'],
      answer_index: 0,
      hint: '가운데 부분에서 누가 무엇을 알려 주었는지 생각해 보세요.',
    },
    {
      question: '이야기는 어떻게 끝났나요?',
      choices: [lines[lines.length - 1] ?? '마지막 장면', lines[0] ?? '처음 장면', lines[1] ?? '두 번째 장면', '문제가 해결되지 않았어요'],
      answer_index: 0,
      hint: '마지막 문장을 다시 떠올려 보세요.',
    },
  ]
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [dashboardAnswers, setDashboardAnswers] = useState<DashboardAnswer[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([null, null, null, null])
  const [attemptCounts, setAttemptCounts] = useState([0, 0, 0, 0])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState<Step>('today')
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false)

  const todayStory = stories[0]
  const questions = getStoryQuestions(todayStory)
  const currentQuestion = questions[currentQuestionIndex]
  const currentSelectedAnswer = selectedAnswers[currentQuestionIndex] ?? null
  const currentAttemptCount = attemptCounts[currentQuestionIndex] ?? 0
  const currentLine = todayStory?.lines[currentLineIndex]
  const currentReader = getReader(currentLineIndex)
  const isLastLine = todayStory ? currentLineIndex === todayStory.lines.length - 1 : false
  const isCorrect =
    currentSelectedAnswer !== null && currentQuestion
      ? currentSelectedAnswer === currentQuestion.answer_index
      : null


  useEffect(() => {
    const loadPrivateData = async (currentUser: User) => {
      const [{ data: profileData }, { data: storyData }] = await Promise.all([
        supabase
          .from('users')
          .select('id, role, name')
          .eq('id', currentUser.id)
          .maybeSingle(),
        supabase.from('stories').select('*').order('created_at', { ascending: true }),
      ])

      const currentProfile = profileData as Profile | null
      setProfile(currentProfile)
      setStories((storyData ?? []) as Story[])

      if (currentProfile?.role === 'parent') {
        const { data: answerData } = await supabase
          .from('question_answers')
          .select('id, selected_index, is_correct, attempt_count, created_at, stories(title)')
          .order('created_at', { ascending: false })
          .limit(20)

        setDashboardAnswers((answerData ?? []) as DashboardAnswer[])
      } else {
        setDashboardAnswers([])
      }
    }

    const loadInitialData = async () => {
      const { data } = await supabase.auth.getUser()
      const currentUser = data.user

      setUser(currentUser)

      if (currentUser) {
        await loadPrivateData(currentUser)
      }

      setIsLoading(false)
    }

    void loadInitialData()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        void loadPrivateData(currentUser)
      } else {
        setProfile(null)
        setStories([])
        setDashboardAnswers([])
        setSelectedAnswers([null, null, null, null])
        setAttemptCounts([0, 0, 0, 0])
        setCurrentQuestionIndex(0)
        setMessage('')
        setCurrentStep('today')
        setCurrentLineIndex(0)
        setActiveSessionId(null)
        setShowHint(false)
        setShowCorrectAnswer(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const createReadingSession = async () => {
    if (!user || !todayStory) return null

    if (activeSessionId) {
      return activeSessionId
    }

    const { data } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        story_id: todayStory.id,
        status: 'reading',
        current_step: 'reading',
      })
      .select('id')
      .single()

    const sessionId = data?.id ?? null
    setActiveSessionId(sessionId)
    return sessionId
  }

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setMessage('이 브라우저에서는 음성 재생을 지원하지 않습니다.')
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.86
    utterance.pitch = 1.05

    const voices = window.speechSynthesis.getVoices()
    const koreanVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('ko'))
    if (koreanVoice) {
      utterance.voice = koreanVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }

  const handleStartReading = async () => {
    await createReadingSession()
    setCurrentStep('reading')
    setCurrentLineIndex(0)
    setSelectedAnswers([null, null, null, null])
    setAttemptCounts([0, 0, 0, 0])
    setCurrentQuestionIndex(0)
    setShowHint(false)
    setShowCorrectAnswer(false)
    setMessage('AI 선생님과 아이가 번갈아 읽어 볼까요?')
  }

  const handlePlayCurrentLine = () => {
    if (!currentLine) return
    speak(currentLine)
  }

  const handleGoToQuestion = async () => {
    stopSpeaking()

    if (activeSessionId) {
      await supabase
        .from('sessions')
        .update({ status: 'question', current_step: 'question' })
        .eq('id', activeSessionId)
    }

    setCurrentStep('question')
    setMessage('이야기를 다 읽었어요. 이제 문제를 풀어 보세요.')
  }

  const handleNextLine = async () => {
    if (!todayStory) return

    stopSpeaking()

    if (!isLastLine) {
      setCurrentLineIndex((index) => index + 1)
      setMessage('다음 문장으로 넘어갔어요.')
      return
    }

    await handleGoToQuestion()
  }

  const handlePrevLine = () => {
    stopSpeaking()
    setCurrentLineIndex((index) => Math.max(0, index - 1))
    setMessage('이전 문장으로 돌아왔어요.')
  }

  const handleAnswer = async (index: number) => {
    if (!todayStory || !user || !currentQuestion) return

    const nextAttemptCount = currentAttemptCount + 1
    const correct = index === currentQuestion.answer_index

    const nextSelectedAnswers = [...selectedAnswers]
    nextSelectedAnswers[currentQuestionIndex] = index
    const willComplete = questions.every((_, questionIndex) => nextSelectedAnswers[questionIndex] !== null)

    setSelectedAnswers(nextSelectedAnswers)
    setAttemptCounts((counts) => {
      const next = [...counts]
      next[currentQuestionIndex] = nextAttemptCount
      return next
    })
    setShowHint(!correct)
    setShowCorrectAnswer(!correct && nextAttemptCount >= 2)

    setMessage(correct ? '정답이에요!' : '아쉬워요. 힌트를 보고 다시 골라 보세요.')

    const sessionId = activeSessionId ?? (await createReadingSession())

    if (sessionId) {
      await supabase.from('question_answers').insert({
        user_id: user.id,
        story_id: todayStory.id,
        session_id: sessionId,
        selected_index: index,
        is_correct: correct,
        attempt_count: nextAttemptCount,
      })

      if (willComplete) {
        await supabase
          .from('sessions')
          .update({ status: 'completed', current_step: 'completed', completed_at: new Date().toISOString() })
          .eq('id', sessionId)
      }
    }

    if (willComplete) {
      setCurrentStep('complete')
      setMessage('오늘 할 일을 모두 완료했어요! 글과 문제를 한 번에 복습해 보세요.')
    }
  }

  const handleRetryQuestion = () => {
    setSelectedAnswers((answers) => {
      const next = [...answers]
      next[currentQuestionIndex] = null
      return next
    })
    setMessage('다시 한 번 골라 보세요.')
  }

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))
    setShowHint(false)
    setShowCorrectAnswer(false)
    setMessage('다음 문제를 풀어 보세요.')
  }

  const handlePrevQuestion = () => {
    setCurrentQuestionIndex((index) => Math.max(0, index - 1))
    setShowHint(false)
    setShowCorrectAnswer(false)
    setMessage('이전 문제로 돌아왔어요.')
  }

  const handleLogout = async () => {
    stopSpeaking()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setStories([])
    setDashboardAnswers([])
  }

  const getAnswerStoryTitle = (answer: DashboardAnswer) => {
    const story = Array.isArray(answer.stories) ? answer.stories[0] : answer.stories
    return story?.title ?? '이야기'
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-orange-50 p-8 text-zinc-900">
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-zinc-500 shadow-sm ring-1 ring-orange-100">
          로그인 상태를 확인하는 중...
        </p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center gap-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-orange-600">읽기·그림 세션</p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              아이가 AI와 함께 읽고 만드는 나만의 책
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              아이는 AI 선생님과 문장을 번갈아 읽고 이해 질문에 답해요. 보호자는 대시보드에서
              아이의 이해도와 재시도 기록을 확인합니다.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">1</p>
              <h2 className="mt-3 font-bold">아이 세션</h2>
              <p className="mt-2 text-sm text-zinc-500">아이는 오늘의 이야기를 AI와 함께 읽어요.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">2</p>
              <h2 className="mt-3 font-bold">AI TTS</h2>
              <p className="mt-2 text-sm text-zinc-500">AI 선생님의 음성을 듣고 따라 읽을 수 있어요.</p>
            </article>
            <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-orange-100">
              <p className="text-2xl font-bold text-orange-600">3</p>
              <h2 className="mt-3 font-bold">보호자 확인</h2>
              <p className="mt-2 text-sm text-zinc-500">보호자는 대시보드에서 오답과 재시도를 확인해요.</p>
            </article>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-orange-600 px-6 py-4 text-center font-bold text-white shadow-sm"
            >
              로그인하기
            </Link>
            <Link
              href="/signup"
              className="rounded-2xl bg-white px-6 py-4 text-center font-bold text-orange-700 shadow-sm ring-1 ring-orange-100"
            >
              회원가입하기
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (profile?.role === 'parent') {
    return (
      <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
        <section className="mx-auto flex max-w-4xl flex-col gap-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold text-orange-600">보호자 대시보드</p>
              <h1 className="text-3xl font-bold">아이의 읽기 기록 확인</h1>
              <p className="mt-3 text-zinc-600">
                보호자는 읽기 세션에 참여하지 않고 아이의 답변, 오답, 재시도 기록을 확인합니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-orange-100">
              <p className="font-semibold">{profile.name}</p>
              <p className="text-zinc-500">보호자 계정</p>
              <p className="text-zinc-500">{user.email}</p>
              <button onClick={handleLogout} className="mt-2 font-semibold text-orange-700 underline">
                로그아웃
              </button>
            </div>
          </header>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <h2 className="text-xl font-bold">이해 질문 기록</h2>
            {dashboardAnswers.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {dashboardAnswers.map((answer) => (
                  <li key={answer.id} className="rounded-2xl border border-orange-100 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-bold">{getAnswerStoryTitle(answer)}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          answer.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {answer.is_correct ? '정답' : '오답'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      선택: {answer.selected_index + 1}번 · 시도 {answer.attempt_count}회
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(answer.created_at).toLocaleString('ko-KR')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                아직 확인할 답변 기록이 없습니다. RLS가 엄격하면 보호자-아이 연결 테이블이 추가되어야
                아이 기록을 보호자에게 보여줄 수 있습니다.
              </p>
            )}
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-orange-50 p-8 text-zinc-900">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-orange-600">아이 읽기 세션</p>
            <h1 className="text-3xl font-bold">AI 선생님과 함께 읽기</h1>
            <p className="mt-3 text-zinc-600">
              AI 선생님이 한 문장을 읽고, 아이가 다음 문장을 읽으며 이야기를 따라갑니다.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-orange-100">
            <div className="space-y-2">
              <p className="font-semibold">{profile?.name ?? user.email}</p>
              <p className="text-zinc-500">아이 계정</p>
              <p className="text-zinc-500">{user.email}</p>
              <button onClick={handleLogout} className="font-semibold text-orange-700 underline">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        {currentStep === 'today' ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">오늘 읽을 이야기</h2>
                {todayStory ? (
                  <>
                    <p className="mt-2 text-2xl font-bold text-orange-700">{todayStory.title}</p>
                    <p className="mt-3 text-sm text-zinc-500">
                      읽기가 끝나면 다음 화면에서 이해 문제 4개가 나옵니다.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">등록된 이야기가 없습니다.</p>
                )}
              </div>
              {todayStory ? (
                <button
                  type="button"
                  onClick={handleStartReading}
                  className="rounded-2xl bg-orange-600 px-5 py-3 font-bold text-white shadow-sm"
                >
                  읽기 세션 시작
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {todayStory && currentStep === 'reading' ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">읽기</h2>
                <p className="mt-2 text-2xl font-bold text-orange-700">{todayStory.title}</p>
              </div>
              <button
                type="button"
                onClick={handleStartReading}
                className="rounded-2xl bg-white px-5 py-3 font-bold text-orange-700 shadow-sm ring-1 ring-orange-100"
              >
                처음부터 다시 읽기
              </button>
            </div>

            <div className="mt-6 rounded-3xl bg-orange-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-orange-700 shadow-sm">
                  {currentLineIndex + 1} / {todayStory.lines.length}
                </span>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    currentReader === 'ai'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-pink-100 text-pink-700'
                  }`}
                >
                  {getReaderTurnText(currentReader)}
                </span>
              </div>

              <p className="rounded-3xl bg-white p-6 text-2xl font-bold leading-relaxed shadow-sm">
                {currentLine}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={handlePrevLine}
                  disabled={currentLineIndex === 0}
                  className="rounded-2xl bg-white px-4 py-3 font-semibold text-zinc-700 shadow-sm ring-1 ring-orange-100 disabled:opacity-40"
                >
                  이전 문장
                </button>
                <button
                  type="button"
                  onClick={handlePlayCurrentLine}
                  className="rounded-2xl bg-orange-600 px-4 py-3 font-semibold text-white shadow-sm"
                >
                  {isSpeaking ? 'AI 재생 중' : 'AI TTS 듣기'}
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="rounded-2xl bg-white px-4 py-3 font-semibold text-zinc-700 shadow-sm ring-1 ring-orange-100"
                >
                  정지
                </button>
                <button
                  type="button"
                  onClick={handleNextLine}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 font-semibold text-white shadow-sm"
                >
                  {isLastLine ? '문제 풀러 가기' : '다음 문장'}
                </button>
              </div>

              <ol className="mt-6 space-y-2">
                {todayStory.lines.map((line, index) => {
                  const reader = getReader(index)
                  return (
                    <li
                      key={`${todayStory.id}-line-${index}`}
                      className={`rounded-2xl border p-3 text-sm ${
                        index === currentLineIndex
                          ? 'border-orange-400 bg-white font-bold'
                          : 'border-transparent bg-white/60 text-zinc-500'
                      }`}
                    >
                      <span className="mr-2 text-orange-600">{getReaderLabel(reader)}</span>
                      {line}
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>
        ) : null}

        {todayStory && currentStep === 'complete' ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <div className="rounded-3xl bg-green-50 p-6 text-center ring-1 ring-green-100">
              <p className="text-sm font-bold text-green-700">오늘 할 일 완료</p>
              <h2 className="mt-2 text-3xl font-extrabold text-green-800">잘했어요! 오늘 읽기 세션을 끝냈어요.</h2>
              <p className="mt-3 text-zinc-600">읽기와 이해 질문 4문제를 모두 마쳤습니다. 아래에서 오늘 배운 내용을 복습해 보세요.</p>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-orange-600">오늘 읽은 이야기</p>
              <h3 className="mt-2 text-2xl font-bold text-orange-700">{todayStory.title}</h3>
              <ol className="mt-5 space-y-3">
                {todayStory.lines.map((line, index) => (
                  <li key={`${todayStory.id}-review-line-${index}`} className="rounded-2xl bg-orange-50 p-4">
                    <span className="mr-3 font-bold text-orange-500">{index + 1}</span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-orange-600">풀었던 문제</p>
              <ul className="mt-4 space-y-4">
                {questions.map((question, questionIndex) => {
                  const selected = selectedAnswers[questionIndex]
                  const correct = selected === question.answer_index
                  return (
                    <li key={`${todayStory.id}-review-question-${questionIndex}`} className="rounded-2xl border border-orange-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-bold">{questionIndex + 1}. {question.question}</p>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {correct ? '정답' : '오답'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-zinc-600">
                        내가 고른 답: {selected === null ? '없음' : `${selected + 1}번 ${question.choices[selected]}`}
                      </p>
                      <p className="mt-1 text-sm text-green-700">
                        정답: {question.answer_index + 1}번 {question.choices[question.answer_index]}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setCurrentStep('reading')}
                className="rounded-2xl bg-white px-5 py-3 font-bold text-orange-700 shadow-sm ring-1 ring-orange-100"
              >
                이야기 다시 보기
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('question')
                  setCurrentQuestionIndex(0)
                  setMessage('복습 문제를 다시 확인해 보세요.')
                }}
                className="rounded-2xl bg-orange-600 px-5 py-3 font-bold text-white shadow-sm"
              >
                문제 다시 보기
              </button>
            </div>
          </section>
        ) : null}

        {todayStory && currentStep === 'question' && currentQuestion ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-orange-100">
            <p className="mb-2 text-sm font-semibold text-orange-600">이해 질문</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">문제를 풀어 볼까요?</h2>
                <p className="mt-2 text-sm font-semibold text-orange-700">
                  문제 {currentQuestionIndex + 1} / {questions.length}
                </p>
              </div>
              <div className="flex gap-2">
                {questions.map((question, index) => {
                  const selected = selectedAnswers[index]
                  const solved = selected !== null && selected === question.answer_index
                  return (
                    <button
                      key={`${todayStory.id}-question-tab-${index}`}
                      type="button"
                      onClick={() => {
                        setCurrentQuestionIndex(index)
                        setShowHint(false)
                        setShowCorrectAnswer(false)
                        setMessage(`${index + 1}번 문제입니다.`)
                      }}
                      className={`h-9 w-9 rounded-full text-sm font-bold ${
                        index === currentQuestionIndex
                          ? 'bg-orange-600 text-white'
                          : solved
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="mt-5 text-lg font-semibold">{currentQuestion.question}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {currentQuestion.choices.map((choice, index) => {
                const isSelected = currentSelectedAnswer === index
                return (
                  <li key={`${todayStory.id}-choice-${currentQuestionIndex}-${index}`}>
                    <button
                      type="button"
                      onClick={() => handleAnswer(index)}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        isSelected
                          ? isCorrect
                            ? 'border-green-500 bg-green-50'
                            : 'border-red-500 bg-red-50'
                          : 'border-orange-100 bg-white hover:bg-orange-50'
                      }`}
                    >
                      <span className="mr-3 font-bold text-orange-500">{index + 1}</span>
                      {choice}
                    </button>
                  </li>
                )
              })}
            </ul>

            {showHint ? (
              <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm text-zinc-700">
                <p className="font-bold text-orange-700">힌트</p>
                <p className="mt-1">{currentQuestion.hint}</p>
              </div>
            ) : null}

            {showCorrectAnswer ? (
              <div className="mt-3 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
                정답은 {currentQuestion.answer_index + 1}번, “{currentQuestion.choices[currentQuestion.answer_index]}”입니다.
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
                className="rounded-2xl bg-white px-5 py-3 font-bold text-orange-700 shadow-sm ring-1 ring-orange-100 disabled:opacity-40"
              >
                이전 문제
              </button>
              {isCorrect === false ? (
                <button
                  type="button"
                  onClick={handleRetryQuestion}
                  className="rounded-2xl bg-orange-600 px-5 py-3 font-bold text-white shadow-sm"
                >
                  다시 풀기
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
                className="rounded-2xl bg-zinc-900 px-5 py-3 font-bold text-white shadow-sm disabled:opacity-40"
              >
                다음 문제
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('reading')}
                className="rounded-2xl bg-white px-5 py-3 font-bold text-orange-700 shadow-sm ring-1 ring-orange-100"
              >
                이야기 다시 보기
              </button>
            </div>

            {message ? <p className="mt-4 font-semibold text-orange-700">{message}</p> : null}
          </section>
        ) : message ? (
          <p className="rounded-2xl bg-white p-4 font-semibold text-orange-700 shadow-sm ring-1 ring-orange-100">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  )
}
