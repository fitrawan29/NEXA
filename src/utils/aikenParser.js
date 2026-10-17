/**
 * Aiken Format Parser for NEXA CBT
 * Pure JavaScript - Zero Dependencies
 * 
 * Supports:
 * - Single and multiline questions (soal bertingkat / stimulus reading passages)
 * - Choices A-E / a-e with period or parenthesis delimiters (e.g. "A." or "A)")
 * - Case-insensitive ANSWER / KUNCI / JAWABAN keywords
 * - Maps answer letter to exact option string text for NEXA CBT scoring contract
 * - Detailed error trapping and diagnostics per question block
 */

export function parseAiken(text, defaultBobot = 10) {
  if (!text || typeof text !== 'string') {
    return { questions: [], errors: [], total: 0, validCount: 0, errorCount: 0 };
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const questions = [];
  const errors = [];

  let currentQuestionLines = [];
  let currentOptions = {};
  let currentOptionOrder = [];
  let questionStartLine = 1;
  let inOptions = false;

  const optionRegex = /^([A-Ea-e])[\.\)]\s*(.*)$/;
  const answerRegex = /^(?:ANSWER|KUNCI|JAWABAN)\s*:\s*([A-Za-z])\s*$/i;

  function finalizeQuestion(endLine) {
    const qText = currentQuestionLines.join('\n').trim();
    const optKeys = currentOptionOrder;

    if (!qText && optKeys.length === 0) return;

    const blockIndex = questions.length + errors.length + 1;

    if (!qText) {
      errors.push({
        index: blockIndex,
        line: questionStartLine,
        message: 'Teks pertanyaan tidak boleh kosong.',
        snippet: optKeys.length > 0 ? `${optKeys[0]}. ${currentOptions[optKeys[0]]}` : ''
      });
      return;
    }

    if (optKeys.length < 2) {
      errors.push({
        index: blockIndex,
        line: questionStartLine,
        message: `Pilihan jawaban kurang dari 2 (hanya ditemukan ${optKeys.length} pilihan).`,
        snippet: qText.substring(0, 50)
      });
      return;
    }

    errors.push({
      index: blockIndex,
      line: questionStartLine,
      message: 'Kunci jawaban (ANSWER: X) tidak ditemukan sebelum soal berikutnya atau akhir teks.',
      snippet: qText.substring(0, 50)
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed) {
      if (!inOptions && currentQuestionLines.length > 0) {
        currentQuestionLines.push('');
      }
      continue;
    }

    const ansMatch = trimmed.match(answerRegex);
    if (ansMatch) {
      const qText = currentQuestionLines.join('\n').trim();
      const ansKey = ansMatch[1].toUpperCase();
      const optKeys = currentOptionOrder;
      const blockIndex = questions.length + errors.length + 1;

      let hasError = false;
      if (!qText) {
        errors.push({ index: blockIndex, line: questionStartLine, message: 'Teks pertanyaan tidak boleh kosong.' });
        hasError = true;
      }
      if (optKeys.length < 2) {
        errors.push({ index: blockIndex, line: questionStartLine, message: `Pilihan jawaban kurang dari 2 (hanya ${optKeys.length} pilihan).` });
        hasError = true;
      }
      if (optKeys.length >= 2 && !currentOptions[ansKey]) {
        errors.push({ index: blockIndex, line: lineNum, message: `Kunci jawaban '${ansKey}' tidak cocok dengan pilihan yang tersedia (${optKeys.join(', ')}).` });
        hasError = true;
      }

      if (!hasError) {
        const opsiArray = optKeys.map(k => currentOptions[k]);
        questions.push({
          index: blockIndex,
          pertanyaan: qText.replace(/\n/g, '<br/>'),
          pertanyaanRaw: qText,
          opsi: opsiArray,
          opsiMap: { ...currentOptions },
          kunci_letter: ansKey,
          kunci_jawaban: currentOptions[ansKey], // Literal text of correct option for NEXA contract
          tipe_soal: 'PG',
          bobot: Number(defaultBobot) || 10
        });
      }

      currentQuestionLines = [];
      currentOptions = {};
      currentOptionOrder = [];
      inOptions = false;
      questionStartLine = lineNum + 1;
      continue;
    }

    const optMatch = trimmed.match(optionRegex);
    if (optMatch) {
      inOptions = true;
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      if (!currentOptions[letter]) {
        currentOptionOrder.push(letter);
      }
      currentOptions[letter] = text;
      continue;
    }

    if (inOptions) {
      finalizeQuestion(lineNum);
      currentQuestionLines = [line];
      currentOptions = {};
      currentOptionOrder = [];
      inOptions = false;
      questionStartLine = lineNum;
    } else {
      if (currentQuestionLines.length === 0) {
        questionStartLine = lineNum;
      }
      currentQuestionLines.push(line);
    }
  }

  if (currentQuestionLines.length > 0 || currentOptionOrder.length > 0) {
    finalizeQuestion(lines.length);
  }

  return {
    questions,
    errors,
    total: questions.length + errors.length,
    validCount: questions.length,
    errorCount: errors.length
  };
}

/**
 * Format questions into standard payload array for Supabase batch insertion
 */
export function prepareAikenPayload(questions, mapelId, npsn, defaultBobot = 10) {
  const timestamp = Date.now().toString(36).toUpperCase();
  return (questions || []).map((q, idx) => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return {
      id_soal: `SOAL-${mapelId}-${timestamp}-${randomHex}-${idx}`,
      id_mapel: mapelId,
      npsn: npsn,
      tipe_soal: 'PG',
      pertanyaan: q.pertanyaan,
      opsi: JSON.stringify(q.opsi),
      kunci_jawaban: q.kunci_jawaban,
      bobot: Number(q.bobot) || Number(defaultBobot) || 10,
      gambar: null,
      id_narasi: null
    };
  });
}
