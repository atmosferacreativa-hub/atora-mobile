import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchQuiz, submitQuiz } from '../api/quizzes';
import { colors, spacing } from '../theme';
import type { QuizAnswer, QuizPayload, QuizQuestion, QuizResult } from '../types';

type Props = {
  lessonId: number;
  token: string;
  onBack: () => void;
  onCompleted: () => void;
};

const hasAnswer = (answer: QuizAnswer | undefined) =>
  Array.isArray(answer) ? answer.length > 0 : String(answer ?? '').trim().length > 0;

function Option({
  label,
  selected,
  multiple,
  onPress,
}: {
  label: string;
  selected: boolean;
  multiple: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
    >
      <View style={[multiple ? styles.checkbox : styles.radio, selected && styles.choiceSelected]}>
        {selected ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
}: {
  question: QuizQuestion;
  answer: QuizAnswer | undefined;
  onChange: (answer: QuizAnswer) => void;
}) {
  if (question.type === 'text' || question.type === 'textarea' || question.type === 'number') {
    return (
      <TextInput
        accessibilityLabel="Tu respuesta"
        keyboardType={question.type === 'number' ? 'numeric' : 'default'}
        multiline={question.type === 'textarea'}
        onChangeText={onChange}
        placeholder={question.type === 'textarea' ? 'Escribe aquí tu respuesta…' : 'Tu respuesta'}
        style={[styles.input, question.type === 'textarea' && styles.textarea]}
        value={Array.isArray(answer) ? '' : String(answer ?? '')}
      />
    );
  }

  const options = question.type === 'true_false' && question.options.length === 0
    ? ['Verdadero', 'Falso']
    : question.options;

  return (
    <View style={styles.options}>
      {options.map((option) => {
        const values = Array.isArray(answer) ? answer : [];
        const selected = question.type === 'multiple' ? values.includes(option) : answer === option;
        return (
          <Option
            key={option}
            label={option}
            multiple={question.type === 'multiple'}
            selected={selected}
            onPress={() => {
              if (question.type !== 'multiple') {
                onChange(option);
                return;
              }
              onChange(selected ? values.filter((item) => item !== option) : [...values, option]);
            }}
          />
        );
      })}
    </View>
  );
}

export function QuizScreen({ lessonId, token, onBack, onCompleted }: Props) {
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [answers, setAnswers] = useState<Record<number, QuizAnswer>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchQuiz(lessonId, token)
      .then((value) => {
        if (!active) return;
        setQuiz(value);
        setRemaining(value.remaining_seconds);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No pudimos abrir la evaluación.');
      });
    return () => { active = false; };
  }, [lessonId, token]);

  useEffect(() => {
    if (!quiz || quiz.remaining_seconds <= 0 || result) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [quiz, result]);

  const answered = useMemo(
    () => quiz?.questions.filter((question) => hasAnswer(answers[question.id])).length ?? 0,
    [answers, quiz],
  );
  const question = quiz?.questions[index];
  const total = quiz?.questions.length ?? 0;
  const urgent = remaining > 0 && remaining <= 60;
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const performSubmit = async () => {
    if (!quiz) return;
    setBusy(true);
    setError('');
    try {
      const payload = quiz.questions.map((item) => answers[item.id] ?? (item.type === 'multiple' ? [] : ''));
      const nextResult = await submitQuiz(lessonId, quiz.token, payload, token);
      setResult(nextResult);
      onCompleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible entregar la evaluación.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSubmit = () => {
    const unanswered = total - answered;
    Alert.alert(
      '¿Entregar evaluación?',
      unanswered > 0
        ? `Quedan ${unanswered} preguntas sin responder. Puedes volver y revisarlas.`
        : 'Tus respuestas quedarán registradas. Revisa antes de confirmar.',
      [
        { text: 'Seguir revisando', style: 'cancel' },
        { text: 'Entregar ahora', onPress: () => void performSubmit() },
      ],
    );
  };

  if (!quiz && !error) return <View style={styles.center}><ActivityIndicator color={colors.blue} size="large" /></View>;

  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.resultPage}>
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>EVALUACIÓN ENTREGADA</Text>
          <Text style={styles.score}>{result.score}%</Text>
          <Text style={styles.resultTitle}>Resultado del intento {result.attempt}</Text>
          <Text style={styles.message}>{result.student_message || 'Tu resultado quedó registrado correctamente.'}</Text>
          {result.best_score !== result.score ? <Text style={styles.best}>Mejor resultado: {result.best_score}%</Text> : null}
          <Pressable onPress={onBack} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Volver a la lección</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (!quiz || !question) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.error}>{error || 'Esta evaluación no tiene preguntas disponibles.'}</Text>
        <Pressable onPress={onBack} style={styles.secondaryButton}><Text style={styles.secondaryText}>Volver</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>← Salir</Text></Pressable>
        {quiz.remaining_seconds > 0 ? (
          <View style={[styles.timer, urgent && styles.timerUrgent]}>
            <Text style={[styles.timerText, urgent && styles.timerUrgentText]}>{formatTime(remaining)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Pregunta {index + 1} de {total}</Text>
        <Text style={styles.answered}>{answered} respondidas</Text>
      </View>
      <View style={styles.track}><View style={[styles.progress, { width: `${((index + 1) / total) * 100}%` }]} /></View>

      <ScrollView contentContainerStyle={styles.questionScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.question}</Text>
          {question.type === 'multiple' ? <Text style={styles.hint}>Puedes seleccionar varias opciones.</Text> : null}
          <QuestionInput
            question={question}
            answer={answers[question.id]}
            onChange={(answer) => setAnswers((current) => ({ ...current, [question.id]: answer }))}
          />
        </View>
        {remaining === 0 && quiz.remaining_seconds > 0 ? (
          <Text accessibilityRole="alert" style={styles.error}>El tiempo terminó. Intenta entregar tus respuestas.</Text>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          disabled={index === 0 || busy}
          onPress={() => setIndex((value) => value - 1)}
          style={[styles.navButton, index === 0 && styles.disabled]}
        >
          <Text style={styles.navText}>Anterior</Text>
        </Pressable>
        {index < total - 1 ? (
          <Pressable
            disabled={busy}
            onPress={() => setIndex((value) => value + 1)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Siguiente</Text>
          </Pressable>
        ) : (
          <Pressable disabled={busy} onPress={confirmSubmit} style={styles.submitButton}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Revisar y entregar</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.paper, flex: 1 },
  center: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  topbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  back: { color: colors.blue, fontSize: 16, fontWeight: '800' },
  timer: { backgroundColor: '#E8F0F7', borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  timerUrgent: { backgroundColor: '#FDECEC' },
  timerText: { color: colors.navy, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '900' },
  timerUrgentText: { color: colors.red },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressLabel: { color: colors.navy, fontWeight: '800' },
  answered: { color: colors.muted, fontSize: 13 },
  track: { backgroundColor: colors.border, height: 6, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  progress: { backgroundColor: colors.mustard, height: 6 },
  questionScroll: { padding: spacing.lg },
  questionCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  questionText: { color: colors.ink, fontSize: 21, fontWeight: '800', lineHeight: 30 },
  hint: { color: colors.muted, fontSize: 13 },
  options: { gap: spacing.sm },
  option: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 14, borderWidth: 2, flexDirection: 'row', gap: spacing.md, minHeight: 58, padding: spacing.md },
  optionSelected: { backgroundColor: '#EAF2F9', borderColor: colors.blue },
  pressed: { opacity: 0.75 },
  radio: { alignItems: 'center', borderColor: colors.muted, borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkbox: { alignItems: 'center', borderColor: colors.muted, borderRadius: 6, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  choiceSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  check: { color: colors.white, fontSize: 15, fontWeight: '900' },
  optionText: { color: colors.ink, flex: 1, fontSize: 16, lineHeight: 23 },
  optionTextSelected: { color: colors.navy, fontWeight: '700' },
  input: { backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 14, borderWidth: 2, color: colors.ink, fontSize: 17, minHeight: 56, padding: spacing.md },
  textarea: { minHeight: 150, textAlignVertical: 'top' },
  error: { color: colors.red, lineHeight: 20, textAlign: 'center' },
  actions: { backgroundColor: colors.white, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  navButton: { alignItems: 'center', borderColor: colors.blue, borderRadius: 14, borderWidth: 2, flex: 1, justifyContent: 'center', minHeight: 54 },
  navText: { color: colors.blue, fontSize: 16, fontWeight: '800' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 54, paddingHorizontal: spacing.md },
  submitButton: { alignItems: 'center', backgroundColor: colors.success, borderRadius: 14, flex: 1.4, justifyContent: 'center', minHeight: 54, paddingHorizontal: spacing.md },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderColor: colors.blue, borderRadius: 14, borderWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  secondaryText: { color: colors.blue, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  resultPage: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  resultCard: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: spacing.md, padding: spacing.xl },
  resultEyebrow: { color: colors.success, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  score: { color: colors.navy, fontSize: 58, fontWeight: '900' },
  resultTitle: { color: colors.navy, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  best: { color: colors.blue, fontWeight: '800' },
});
