<template>
  <div class="broadcast-wrapper">
    <div v-if="isIpBrownlisted && !activeBroadcast" class="device-bar">
      <div class="audio-status" :class="isAudioUnlocked ? 'unlocked' : 'locked'" @click="unlockAudio" title="點擊網頁任意處即可解鎖">
        {{ isAudioUnlocked ? '🔊 廣播音效已連線解鎖' : '🔇 音效待解鎖 (點擊畫面任一處即可)' }}
      </div>

      <div class="device-badge" @click="setDeviceName" title="點擊設定此台電腦的廣播專屬名稱">
        <span v-if="!deviceName" class="pulse-dot"></span>
        💻 接收名稱：<span class="d-name">{{ deviceName || '尚未設定 (點擊綁定)' }}</span>
      </div>
    </div>

    <div v-if="activeBroadcast" class="broadcast-container">
      <div class="broadcast-content">
        <span class="broadcast-icon">📢 系統廣播：</span>
        <div class="broadcast-text">
          <span>{{ activeBroadcast.text }}</span>
        </div>
      </div>
    </div>

    <audio ref="audioPlayerRef" style="display: none;" preload="auto"></audio>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { dueBroadcastSchedules, taiwanBroadcastClock } from '../../app/utils/broadcastSchedule.mjs'
const supabase = useSupabaseClient()

const props = defineProps({
  isIpBrownlisted: { type: Boolean, default: false }
})

const activeBroadcast = ref(null) 
let pollingInterval = null
let scheduleInterval = null
let hideTimeout = null 
const lastTriggeredScheduleTime = ref('')
let checkingScheduleMinute = ''
const myIp = ref('')
const deviceName = ref('')

const isAudioUnlocked = ref(false)
const audioPool = {}
const audioPlayerRef = ref(null)

const sounds = {
  bell_ring: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/bell_ring.mp3',
  door_bell: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/door_bell.mp3',
  computer_error: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/computer_error.mp3',
  water_droplet: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/water_droplet.mp3',
  glass: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/glass.mp3',
  tap: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/tap.mp3',
  branch_break: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/branch_break.mp3',
  button_tiny: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_tiny.mp3',
  button_click: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_click.mp3',
  button_push: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/button_push.mp3',
  camera_flashing: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/camera_flashing.mp3',
  cd_tray: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/cd_tray.mp3',
  door_bump: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/door_bump.mp3',
  keyboard_desk: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/keyboard_desk.mp3',
  metal_plate: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/metal_plate.mp3',
  pop_cork: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/pop_cork.mp3',
  snap: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/snap.mp3',
  staple_gun: 'https://cdn.jsdelivr.net/gh/ionden/ion.sound@3.0.7/sounds/staple_gun.mp3',
  chord_1: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_1.mp3',
  chord_2: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_2.mp3',
  chord_3: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_3.mp3',
  heater_1: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-1.mp3',
  heater_2: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-2.mp3',
  heater_3: 'https://s3.amazonaws.com/freecodecamp/drums/Heater-3.mp3',
  kick_n_hat: 'https://s3.amazonaws.com/freecodecamp/drums/Kick_n_Hat.mp3',
  punchy_kick: 'https://s3.amazonaws.com/freecodecamp/drums/punchy_kick_1.mp3',
  side_stick: 'https://s3.amazonaws.com/freecodecamp/drums/side_stick_1.mp3',
  brk_snr: 'https://s3.amazonaws.com/freecodecamp/drums/Brk_Snr.mp3',
  dry_ohh: 'https://s3.amazonaws.com/freecodecamp/drums/Dry_Ohh.mp3',
  dsc_oh: 'https://s3.amazonaws.com/freecodecamp/drums/Dsc_Oh.mp3'
}

const unlockAudio = () => {
  if (isAudioUnlocked.value) return
  isAudioUnlocked.value = true

  const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA")
  silentAudio.play().catch(()=>{})

  for (const [key, url] of Object.entries(sounds)) {
    const a = new Audio(url)
    a.preload = 'auto'
    audioPool[key] = a
  }

  window.removeEventListener('click', unlockAudio)
  window.removeEventListener('touchstart', unlockAudio)
}

const fetchMyIp = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    myIp.value = data.ip
  } catch (e) {}
}

const setDeviceName = () => {
  const input = prompt('請為這台電腦設定專屬名稱（例如：701教室），以便後台進行單獨廣播：', deviceName.value)
  if (input !== null) {
    deviceName.value = input.trim()
    localStorage.setItem('broadcast_device_name', deviceName.value)
    alert(`✅ 已成功將此電腦綁定為「${deviceName.value}」！\n後台指定發送給這個名稱時，就只有這台電腦會響起。`)
  }
}

const playSoundSingle = (soundUrl) => {
  return new Promise((resolve) => {
    if (!audioPlayerRef.value) return resolve() 

    let isResolved = false
    const finish = () => { 
      if (!isResolved) { 
        isResolved = true
        audioPlayerRef.value.onended = null
        audioPlayerRef.value.onerror = null
        resolve() 
      } 
    }
    
    audioPlayerRef.value.src = soundUrl
    audioPlayerRef.value.load()
    audioPlayerRef.value.onended = finish
    audioPlayerRef.value.onerror = finish
    setTimeout(finish, 8000) 
    
    const playPromise = audioPlayerRef.value.play()
    if (playPromise !== undefined) {
      playPromise.catch((e) => { finish() })
    } else { finish() }
  })
}

const speakText = (text) => {
  return new Promise((resolve) => {
    if (!text || !window.speechSynthesis) return resolve()
    
    let isResolved = false
    const finish = () => { if (!isResolved) { isResolved = true; resolve() } }

    window.speechSynthesis.cancel() 
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-TW'
    utterance.rate = 1.0 
    utterance.onend = finish
    utterance.onerror = finish
    
    setTimeout(finish, 15000) 
    window.speechSynthesis.speak(utterance)
  })
}

const triggerBroadcast = async (broadcastData) => {
  activeBroadcast.value = { text: broadcastData.text }
  if (hideTimeout) clearTimeout(hideTimeout)
  
  const soundKey = broadcastData.sound || 'bell_ring'
  if (soundKey !== 'none' && sounds[soundKey]) {
    const count = broadcastData.playCount || 1
    for (let i = 0; i < count; i++) {
      await playSoundSingle(sounds[soundKey])
      await new Promise(r => setTimeout(r, 500)) 
    }
  }

  const ttsCount = broadcastData.textPlayCount || 1
  for (let i = 0; i < ttsCount; i++) {
    await speakText(broadcastData.text)
    if (i < ttsCount - 1) await new Promise(r => setTimeout(r, 800)) 
  }

  const durationSec = broadcastData.displayDuration || 120 
  hideTimeout = setTimeout(() => { activeBroadcast.value = null }, durationSec * 1000)
}

const shouldProcessBroadcast = (targetNameOrIP) => {
  if (!props.isIpBrownlisted) return false; 
  if (targetNameOrIP && targetNameOrIP.trim() !== '') {
    const target = targetNameOrIP.trim()
    return myIp.value === target || deviceName.value === target;
  }
  return true; 
}

const logScheduledBroadcast = async (scheduleText, scheduleSound, targetIP) => {
  await new Promise(r => setTimeout(r, Math.random() * 2000)) 
  try {
    const { data: logData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'broadcast_logs').maybeSingle()
    let logs = logData?.setting_value || []
    
    const isAlreadyLogged = logs.some(l => l.type === '定時自動觸發' && l.text === scheduleText && (Date.now() - l.id < 60000))
    if (!isAlreadyLogged) {
      logs.unshift({
        id: Date.now(),
        time: new Date().toLocaleString('zh-TW', { hour12: false }),
        type: '定時自動觸發',
        text: scheduleText,
        sound: scheduleSound,
        targetIP: targetIP || '全發送',
        ip: myIp.value || '未知IP',
        userAgent: navigator.userAgent
      })
      if (logs.length > 500) logs = logs.slice(0, 500)
      await supabase.from('system_settings').upsert({ setting_key: 'broadcast_logs', setting_value: logs }, { onConflict: 'setting_key' })
    }
  } catch (e) {}
}

// 💡 雙軌監聽：同時監聽「導師後台廣播」與「科任老師前台廣播」
const pollManualBroadcast = async () => {
  if (!props.isIpBrownlisted) return; 
  try {
    const keys = ['broadcast_settings', 'teacher_broadcast_settings']
    const { data } = await supabase.from('system_settings').select('setting_key, setting_value').in('setting_key', keys)
    
    if (data && data.length > 0) {
      data.forEach(row => {
        if (row.setting_value && row.setting_value.manual) {
          const config = row.setting_value.manual
          const storageKey = `last_played_${row.setting_key}`
          const lastPlayedStamp = Number(localStorage.getItem(storageKey)) || 0
          
          if (config.triggerTimestamp > lastPlayedStamp) {
            if (shouldProcessBroadcast(config.targetIP)) { 
              triggerBroadcast(config) 
            }
            localStorage.setItem(storageKey, config.triggerTimestamp)
          }
        }
      })
    }
  } catch (e) {}
}

// 💡 雙軌監聽定時排程：合併「導師後台」與「科任老師前台」的排程
const checkSchedules = async () => {
  if (!props.isIpBrownlisted) return; 

  const clock = taiwanBroadcastClock()
  const minuteKey = `${clock.date} ${clock.time}`

  if (clock.second > 15 || lastTriggeredScheduleTime.value === minuteKey || checkingScheduleMinute === minuteKey) return

  checkingScheduleMinute = minuteKey
  try {
    const keys = ['broadcast_settings', 'teacher_broadcast_settings']
    const { data } = await supabase.from('system_settings').select('setting_value').in('setting_key', keys)
    
    let combinedSchedules = []
    if (data) {
      data.forEach(row => {
        if (row.setting_value && row.setting_value.schedules) {
          combinedSchedules = [...combinedSchedules, ...row.setting_value.schedules]
        }
      })
    }

    const dueSchedules = dueBroadcastSchedules(combinedSchedules, clock, shouldProcessBroadcast)
    if (dueSchedules.length > 0) {
      lastTriggeredScheduleTime.value = minuteKey
      for (const schedule of dueSchedules) {
        await triggerBroadcast(schedule)
        logScheduledBroadcast(schedule.text, schedule.sound, schedule.targetIP)
      }
    }
  } catch (e) {} finally { checkingScheduleMinute = '' }
}

onMounted(() => {
  if (navigator.userActivation && navigator.userActivation.hasBeenActive) { unlockAudio() } 
  else {
    window.addEventListener('click', unlockAudio)
    window.addEventListener('touchstart', unlockAudio)
  }
  
  deviceName.value = localStorage.getItem('broadcast_device_name') || ''
  
  fetchMyIp().then(() => {
    pollManualBroadcast()
    pollingInterval = setInterval(pollManualBroadcast, 5000) 
    scheduleInterval = setInterval(checkSchedules, 1000)     
  })
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
  if (scheduleInterval) clearInterval(scheduleInterval)
  if (hideTimeout) clearTimeout(hideTimeout)
  window.removeEventListener('click', unlockAudio)
  window.removeEventListener('touchstart', unlockAudio)
})
</script>

<style scoped>
.broadcast-wrapper { width: 100%; }

.device-bar { display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-bottom: 8px; flex-wrap: wrap; }
.audio-status { font-size: 0.85rem; padding: 4px 10px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.3s; }
.audio-status.locked { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
.audio-status.unlocked { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

.device-badge { font-size: 0.85rem; color: #94a3b8; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 5px; }
.device-badge:hover { color: #3b82f6; }
.d-name { font-weight: bold; color: #64748b; }
.device-badge:hover .d-name { color: #2563eb; text-decoration: underline; }

.pulse-dot { width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: pulse-dot-anim 1s infinite alternate; }
@keyframes pulse-dot-anim { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0.4; transform: scale(1.2); } }

.broadcast-container { width: 100%; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #78350f; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); border: 2px solid #b45309; position: relative; overflow: hidden; animation: slide-down 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-sizing: border-box; z-index: 50; }
.broadcast-container::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent); animation: shine 3s infinite; }
.broadcast-content { display: flex; align-items: center; font-size: 1.3rem; font-weight: 900; }
.broadcast-icon { margin-right: 15px; animation: pulse-icon 1s infinite alternate; white-space: nowrap; }
.broadcast-text { width: 100%; animation: scroll-text 10s linear infinite alternate; }

@keyframes slide-down { 0% { opacity: 0; transform: translateY(-20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
@keyframes pulse-icon { 0% { transform: scale(1); color: #78350f; } 100% { transform: scale(1.2); color: #dc2626; text-shadow: 0 0 5px #fca5a5; } }
@keyframes scroll-text { 0% { transform: translateX(0); } 100% { transform: translateX(20px); } }
</style>
