import test from 'node:test'
import assert from 'node:assert/strict'
import { displayedExamSchedule, examFontStyles, examLeftTextStyles, normalizeExamSchedule } from '../app/utils/examSchedule.js'

test('existing one-day exam data remains on day one after migration', () => {
  const saved = { title: '原考程', periods: [{ subject: '國文', startTime: '08:00', endTime: '09:00' }], notes: ['帶文具'], theme: 'ocean' }
  const migrated = normalizeExamSchedule(saved)
  assert.equal(migrated.days[0].title, '原考程')
  assert.equal(migrated.days[0].periods[0].subject, '國文')
  assert.deepEqual(migrated.days[0].notes, ['帶文具'])
  assert.deepEqual(migrated.days[1], { title: '', periods: [], notes: [] })
  assert.equal(displayedExamSchedule(saved).title, '原考程')
})

test('homepage uses only the manually selected day and its notes', () => {
  const saved = {
    displayDay: 2,
    days: [
      { title: '第一天', periods: [{ subject: '國文' }], notes: ['第一天提醒'] },
      { title: '第二天', periods: [{ subject: '數學' }], notes: ['第二天提醒'] }
    ]
  }
  const shown = displayedExamSchedule(saved)
  assert.equal(shown.title, '第二天')
  assert.deepEqual(shown.periods.map(p => p.subject), ['數學'])
  assert.deepEqual(shown.notes, ['第二天提醒'])
  assert.equal(displayedExamSchedule({ ...saved, displayDay: 1 }).title, '第一天')
})

test('font sizes are saved as bounded numbers and applied to the board', () => {
  const data = normalizeExamSchedule({ fontSizes: { clock: 90, subject: 60, countdown: 80, notes: 30 } })
  assert.deepEqual(examFontStyles(data), {
    '--ex-clock-size': '90px',
    '--ex-subject-size': '60px',
    '--ex-countdown-size': '80px',
    '--ex-notes-size': '30px',
    '--ex-next-subject-size': '39px',
    '--ex-next-time-size': '23px'
  })
  assert.equal(normalizeExamSchedule({ fontSizes: { clock: 999 } }).fontSizes.clock, 120)
})

test('left table text sizes and colors apply to normal and active rows', () => {
  const theme = { title: '#ffffff', text: '#cccccc', accent: '#00ff00' }
  const data = normalizeExamSchedule({
    leftTextSizes: { header: 30, period: 28, subject: 42, time: 36 },
    leftTextColors: { header: '#112233', period: '#445566', subject: '#778899', time: '#aabbcc' }
  })
  const styles = examLeftTextStyles(data, theme)
  assert.equal(styles['--ex-left-header-size'], '30px')
  assert.equal(styles['--ex-left-header-color'], '#112233')
  assert.equal(styles['--ex-left-subject-size'], '42px')
  assert.equal(styles['--ex-left-subject-color'], '#778899')
  assert.equal(styles['--ex-left-subject-active-color'], '#778899')
  assert.equal(styles['--ex-left-time-active-color'], '#aabbcc')
  assert.equal(styles['--ex-left-period-color'], '#445566')
  assert.equal(normalizeExamSchedule({ leftTextSizes: { time: 999 } }).leftTextSizes.time, 29)
  assert.equal(examLeftTextStyles({ leftTextColors: { subject: 'red' } }, theme)['--ex-left-subject-active-color'], '#00ff00')
})
