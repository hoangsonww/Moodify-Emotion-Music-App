// "Was this right?" widget shown under every detected mood on the
// results screen. Mirrors frontend/src/components/MoodFeedbackWidget.jsx
// in behaviour:
//
//   * ✓ Yes      -- POST { predicted = actual } (confirms, lands in log,
//                   does NOT bump the calibration counter)
//   * ✗ No, it was…  -- opens a chip strip; one tap fires the correction
//   * Skip       -- collapses without sending anything
//
// Anonymous callers see nothing. Once any tap fires we switch into a
// terminal "Thanks!" state until the predicted prop changes (a fresh
// detection re-arms the prompt).

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { isAuthenticated } from '../services/auth';
import { CANONICAL_EMOTIONS, sendMoodFeedback } from '../services/feedback';
import { tapLight } from '../util/haptics';
import { colors, radius, spacing, typography } from '../../theme';

const EMOTION_LABEL = {
  joy: 'Joy',
  love: 'Love',
  sadness: 'Sadness',
  anger: 'Anger',
  fear: 'Fear',
  neutral: 'Neutral',
};

/**
 * @param {object} props
 * @param {string} props.predicted    -- canonical label the model returned.
 * @param {'text'|'speech'|'facial'} [props.inputType]
 * @param {number} [props.confidence] -- optional softmax probability.
 * @param {string} [props.sessionId]  -- optional correlation id.
 * @param {function} [props.onCorrected] -- called with the corrected label
 *                                          when the user supplies one.
 */
export default function MoodFeedbackWidget({
  predicted,
  inputType = 'text',
  confidence = null,
  sessionId = null,
  onCorrected = () => {},
}) {
  const [stage, setStage] = useState('ask'); // ask | choose | done
  const [busy, setBusy] = useState(false);

  // Re-arm whenever the predicted label changes -- a fresh detection
  // (or a user-driven mood switch) is a brand-new chance to give
  // feedback.
  useEffect(() => {
    setStage('ask');
    setBusy(false);
  }, [predicted, sessionId]);

  if (!isAuthenticated()) return null;
  if (!predicted) return null;

  const onConfirm = async () => {
    if (busy) return;
    tapLight();
    setBusy(true);
    await sendMoodFeedback({
      predicted,
      actual: predicted,
      inputType,
      confidence,
      sessionId,
    });
    setBusy(false);
    setStage('done');
  };

  const onPickCorrection = async (actual) => {
    if (busy) return;
    tapLight();
    setBusy(true);
    const ok = await sendMoodFeedback({
      predicted,
      actual,
      inputType,
      confidence,
      sessionId,
    });
    setBusy(false);
    setStage('done');
    if (ok) onCorrected(actual);
  };

  if (stage === 'done') {
    return (
      <View style={styles.panel}>
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.doneText}>Thanks — we'll tune your detections.</Text>
        </View>
      </View>
    );
  }

  if (stage === 'choose') {
    return (
      <View style={styles.panel}>
        <Text style={styles.choosePrompt}>Pick what you actually felt:</Text>
        <View style={styles.chipRow}>
          {CANONICAL_EMOTIONS.filter((e) => e !== predicted).map((label) => (
            <Pressable
              key={label}
              onPress={() => onPickCorrection(label)}
              disabled={busy}
              style={({ pressed }) => [
                styles.chip,
                pressed && { opacity: 0.6 },
                busy && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.chipText}>
                {EMOTION_LABEL[label] || label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              tapLight();
              setStage('ask');
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.chipGhost,
              pressed && { opacity: 0.6 },
              busy && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.chipGhostText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // stage === 'ask'
  return (
    <View style={styles.panel}>
      <Text style={styles.askPrompt}>Was that right?</Text>
      <View style={styles.askRow}>
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnYes,
            pressed && { opacity: 0.85 },
            busy && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={styles.btnYesText}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            tapLight();
            setStage('choose');
          }}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnNo,
            pressed && { opacity: 0.85 },
            busy && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="close-circle-outline" size={16} color={colors.text} />
          <Text style={styles.btnNoText}>No, it was…</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            tapLight();
            setStage('done');
          }}
          accessibilityLabel="Skip feedback"
          hitSlop={8}
          style={({ pressed }) => [styles.btnSkip, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  askPrompt: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  btnYes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  btnYesText: { color: '#0b0b11', fontSize: 13, fontWeight: '800' },
  btnNo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnNoText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  btnSkip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  choosePrompt: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipGhost: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipGhostText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneText: { color: colors.textMuted, fontSize: 13 },
});
