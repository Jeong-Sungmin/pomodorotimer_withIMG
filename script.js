// === YouTube IFrame Player API 로딩 ===
var youtubePlayer;
var youtubeVideoId = null,
  youtubeVideoDuration = 0,
  isYouTubeApiReady = false,
  isYouTubePlayerReady = false;
var youtubeShouldBePlaying = false,
  youtubePausedForNotification = false,
  lastYoutubeError = null;
function onYouTubeIframeAPIReady() {
  isYouTubeApiReady = true;
  console.log("YouTube API Ready.");
}
function onPlayerReady(event) {
  isYouTubePlayerReady = true;
  youtubeVideoDuration = event.target.getDuration();
  const statusMsg = `오디오 로드됨 (${formatTime(youtubeVideoDuration)})`;
  document.getElementById("youtubeStatus").textContent = statusMsg;
  console.log(
    `YouTube Player Ready for video ID: ${youtubeVideoId}. Duration: ${youtubeVideoDuration}s. Status: ${statusMsg}`
  );
  lastYoutubeError = null;
  if (youtubeShouldBePlaying) {
    console.log(
      "Player ready and should be playing, calling playYouTubeAudio..."
    );
    playYouTubeAudio();
  }
}
function onPlayerStateChange(event) {
  let stateMsg = "상태 알 수 없음";
  let stateCode = event.data;
  switch (stateCode) {
    case YT.PlayerState.UNSTARTED:
      stateMsg = "시작 전";
      break;
    case YT.PlayerState.ENDED:
      stateMsg = "종료됨 (반복 재생)";
      break;
    case YT.PlayerState.PLAYING:
      stateMsg = "재생 중";
      lastYoutubeError = null;
      break;
    case YT.PlayerState.PAUSED:
      stateMsg = youtubePausedForNotification
        ? "알림으로 일시정지됨"
        : "일시정지됨";
      break;
    case YT.PlayerState.BUFFERING:
      stateMsg = "버퍼링 중...";
      break;
    case YT.PlayerState.CUED:
      stateMsg = "로드됨 (대기 중)";
      break;
  }
  console.log(`YouTube Player State Change: ${stateCode} (${stateMsg})`);
  if (!lastYoutubeError) {
    document.getElementById("youtubeStatus").textContent = stateMsg;
  }
  if (stateCode === YT.PlayerState.ENDED && youtubeShouldBePlaying) {
    console.log("Looping YouTube video.");
    youtubePlayer.seekTo(0);
    youtubePlayer.playVideo();
  }
  if (stateCode === YT.PlayerState.UNSTARTED && lastYoutubeError) {
    handleYoutubeError(lastYoutubeError);
  }
}
function onPlayerError(event) {
  console.error("YouTube Player Error Code:", event.data);
  lastYoutubeError = event.data;
  handleYoutubeError(event.data);
}
function handleYoutubeError(errorCode) {
  let msg = `로드/재생 실패 (코드: ${errorCode})`;
  switch (errorCode) {
    case 2:
      msg = "잘못된 링크/파라미터";
      break;
    case 5:
      msg = "HTML5 플레이어 오류";
      break;
    case 100:
      msg = "비디오 없음/비공개";
      break;
    case 101:
    case 150:
      msg = "재생 불가 (권한 없음)";
      break;
  }
  document.getElementById("youtubeStatus").textContent = `오류: ${msg}`;
  console.error(`YouTube Error: ${msg} (Code: ${errorCode})`);
  youtubeVideoId = null;
  youtubeShouldBePlaying = false;
}

// === 포모도로 타이머 로직 ===
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM 요소 참조 ---
  const body = document.body;
  const currentTimeDisplay = document.getElementById("currentTimeDisplay");
  const timerDisplay = document.getElementById("timerDisplay");
  const timerStatus = document.getElementById("timerStatus");
  const notificationArea = document.getElementById("notificationArea");
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const resetButton = document.getElementById("resetButton");
  const workDurationInput = document.getElementById("workDurationInput");
  const breakDurationInput = document.getElementById("breakDurationInput");
  const delayInput = document.getElementById("delayInput");
  const notifyInput = document.getElementById("notifyInput");
  const notificationTypeSelect = document.getElementById("notificationType");
  const backgroundTypeSelect = document.getElementById("backgroundType");
  const colorFadeOptionsContainer = document.getElementById(
    "colorFadeOptionsContainer"
  );
  const startColorPicker = document.getElementById("startColorPicker");
  const endColorPicker = document.getElementById("endColorPicker");
  const imageUploadContainer = document.getElementById("imageUploadContainer");
  const imageUpload = document.getElementById("imageUpload");
  const progressVisualizer = document.getElementById("progressVisualizer");
  const fadeOverlay = document.getElementById("fadeOverlay");
  const imageEffectContainer = document.getElementById("imageEffectContainer");
  const backgroundImage = document.getElementById("backgroundImage");
  const youtubeUrlInput = document.getElementById("youtubeUrl");
  const loadYoutubeButton = document.getElementById("loadYoutubeButton");
  const youtubeStatus = document.getElementById("youtubeStatus");
  const modal = document.getElementById("notificationModal");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalMessage = document.getElementById("modalMessage");
  const modalCloseButton = document.getElementById("modalCloseButton");

  // --- 상태 변수 ---
  let timerInterval = null,
    delayInterval = null,
    currentTimeInterval = null;
  let delayRemainingSeconds = 0,
    totalDurationSeconds = 0,
    remainingSeconds = 0;
  let currentTimerMode = "work",
    pomodoroCycleCount = 0;
  let isPaused = false,
    notificationShown = false;
  let audioContext = null;
  let userImageSrc = null;
  let currentStartColor = startColorPicker.value;
  let currentEndColor = endColorPicker.value;

  // --- 기본 함수 ---
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60),
      s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function updateCurrentTime() {
    const now = new Date(),
      h = String(now.getHours()).padStart(2, "0"),
      m = String(now.getMinutes()).padStart(2, "0"),
      s = String(now.getSeconds()).padStart(2, "0");
    currentTimeDisplay.textContent = `${h}:${m}:${s}`;
  }
  function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
  }

  // --- 배경화면 업데이트 ---
  function updateBackground() {
    const elapsedSeconds = totalDurationSeconds - remainingSeconds;
    let progressPercentage =
      totalDurationSeconds > 0
        ? (elapsedSeconds / totalDurationSeconds) * 100
        : 0;
    if (progressPercentage > 100) progressPercentage = 100;
    if (progressPercentage < 0) progressPercentage = 0;
    const selectedType = backgroundTypeSelect.value;
    const startColor = startColorPicker.value;
    const endColor = endColorPicker.value;
    currentStartColor = startColor;
    currentEndColor = endColor;
    fadeOverlay.style.display = "none";
    imageEffectContainer.style.display = "none";
    backgroundImage.style.display = "none";
    backgroundImage.style.opacity = 0;
    progressVisualizer.style.backgroundColor = "transparent";
    let useEffectType = selectedType;
    if (useEffectType === "imageFade") {
      const isImageAvailable =
        userImageSrc &&
        backgroundImage.src === userImageSrc &&
        backgroundImage.complete &&
        backgroundImage.naturalWidth > 0;
      if (isImageAvailable) {
        imageEffectContainer.style.display = "block";
        backgroundImage.style.display = "block";
        backgroundImage.style.opacity = progressPercentage / 100;
        imageEffectContainer.style.backgroundColor = "#000000";
      } else {
        useEffectType = "colorFade";
        if (userImageSrc) {
          console.warn("이미지 로드 실패. 단색 페이드로 대체.");
        }
      }
    }
    if (useEffectType === "colorFade") {
      progressVisualizer.style.backgroundColor = endColor;
      fadeOverlay.style.backgroundColor = startColor;
      fadeOverlay.style.display = "block";
      fadeOverlay.style.height = `${100 - progressPercentage}%`;
    }
  }

  // --- 오디오 및 알림 함수 ---
  function playBeepFallback() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === "suspended") {
        audioContext
          .resume()
          .catch((e) => console.error("AudioContext resume error:", e));
      }
      if (audioContext.state === "running") {
        const o = audioContext.createOscillator(),
          g = audioContext.createGain();
        o.connect(g);
        g.connect(audioContext.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(880, audioContext.currentTime);
        g.gain.setValueAtTime(0.3, audioContext.currentTime);
        o.start(audioContext.currentTime);
        o.stop(audioContext.currentTime + 0.2);
      } else {
        console.warn("AudioContext is not running, cannot play beep.");
      }
    } catch (e) {
      console.error("Web Audio API 실행 오류:", e);
    }
  }
  function triggerSpeech(message) {
    if (
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    ) {
      try {
        const u = new SpeechSynthesisUtterance(message);
        u.lang = "ko-KR";
        u.onerror = (e) => {
          console.error("음성 합성 오류:", e.error);
          playBeepFallback();
        };
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.error("음성 합성 시작 오류:", err);
        playBeepFallback();
      }
    } else {
      console.warn("음성 합성 미지원. 삐 소리로 대체.");
      playBeepFallback();
    }
  }
  function showModal(message) {
    modalMessage.textContent = message;
    modalOverlay.style.display = "block";
    modal.style.display = "block";
  }
  function hideModal() {
    modal.classList.remove("flashing");
    modalOverlay.style.display = "none";
    modal.style.display = "none";
    if (youtubePausedForNotification) {
      resumeYouTubeAudio();
      youtubePausedForNotification = false;
    }
  }
  modalCloseButton.addEventListener("click", hideModal);
  modalOverlay.addEventListener("click", hideModal);

  // --- ★ 알림 처리 로직 수정 ---
  function triggerNotification(message, notificationContext = "general") {
    console.log(
      `Triggering notification: ${notificationContext}, Message: ${message}`
    );
    let pauseYoutube = false; // 유튜브 멈춤 필요 여부

    // 1. 종료 X분 전 알림: 항상 깜빡이는 팝업, 3초 후 자동 닫힘
    if (notificationContext === "minutesBefore") {
      pauseYoutube = true; // 팝업 표시 동안 유튜브 멈춤
      showModal(message);
      modal.classList.add("flashing"); // 깜빡임 클래스 추가

      // 깜빡임 효과 제거 및 자동 닫기 타이머
      setTimeout(() => {
        modal.classList.remove("flashing");
      }, 1100); // 애니메이션 시간(0.5s * 2회) + 약간의 여유
      setTimeout(() => {
        // 모달이 여전히 열려있고, 이 알림에 의해 열렸다면 닫기
        if (
          modal.style.display === "block" &&
          modalMessage.textContent === message
        ) {
          hideModal();
        }
      }, 3000); // 3초 후 자동 닫기

      notificationShown = true; // 알림 표시됨 플래그 (중복 방지용)

      // 2. 타이머 종료 시 알림: 항상 삐 소리
    } else if (notificationContext === "final") {
      playBeepFallback();
      // 종료 시에는 유튜브를 멈출 필요 없음 (이미 타이머 종료됨)
      pauseYoutube = false;
      notificationShown = false; // 종료는 매번 울리도록 (다음 사이클 위해)

      // 3. (향후 확장용) 일반 알림: 사용자가 선택한 방식 따름
    } else {
      const type = notificationTypeSelect.value;
      pauseYoutube = type === "popup" || type === "beep" || type === "speech"; // 팝업/소리/음성 시 유튜브 멈춤

      if (type === "popup") {
        showModal(message);
      } else if (type === "beep") {
        playBeepFallback();
        // 삐 소리는 짧으므로, 바로 유튜브 재개 시도 (pause/resume 로직에서 처리)
        if (pauseYoutube && youtubePausedForNotification) {
          setTimeout(() => {
            if (youtubePausedForNotification) {
              resumeYouTubeAudio();
              youtubePausedForNotification = false;
            }
          }, 300);
        }
      } else if (type === "speech") {
        triggerSpeech(message);
        // 음성 합성 후 유튜브 재개 시도
        if (pauseYoutube && youtubePausedForNotification) {
          setTimeout(() => {
            if (youtubePausedForNotification) {
              resumeYouTubeAudio();
              youtubePausedForNotification = false;
            }
          }, 2000);
        }
      }
      notificationShown = true; // 일반 알림도 표시됨 처리
    }

    // ★ 유튜브 일시정지 처리 (필요한 경우)
    if (
      pauseYoutube &&
      isYouTubePlayerReady &&
      youtubeShouldBePlaying &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      youtubePlayer.pauseVideo();
      youtubePausedForNotification = true;
      console.log("Pausing YouTube for notification.");
    } else if (pauseYoutube) {
      // 유튜브를 멈춰야 하지만, 이미 멈춰있거나 재생 중이 아님
      youtubePausedForNotification = false;
    }
  }

  // --- 유튜브 관련 함수 ---
  function extractVideoID(url) {
    const r =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
    const m = r.exec(url);
    return m ? m[1] : null;
  }
  function loadYouTubeVideo() {
    console.log("Attempting to load YouTube video...");
    if (!isYouTubeApiReady) {
      alert("YouTube API 준비 안됨");
      console.error("YouTube API not ready.");
      return;
    }
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoID(url);
    if (!videoId) {
      alert("유효한 유튜브 링크 입력");
      youtubeStatus.textContent = "잘못된 링크";
      console.warn("Invalid YouTube URL:", url);
      return;
    }
    console.log("Extracted Video ID:", videoId);
    youtubeVideoId = videoId;
    isYouTubePlayerReady = false;
    lastYoutubeError = null;
    youtubeStatus.textContent = "오디오 로딩 중...";
    if (youtubePlayer) {
      console.log("Using existing player, loading video:", youtubeVideoId);
      youtubePlayer.cueVideoById(videoId);
    } else {
      console.log("Creating new YouTube player for:", youtubeVideoId);
      youtubePlayer = new YT.Player("youtube-player", {
        height: "1",
        width: "1",
        videoId: videoId,
        playerVars: { playsinline: 1 },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      });
    }
  }
  function playYouTubeAudio() {
    console.log(
      "Attempting to play YouTube audio... PlayerReady:",
      isYouTubePlayerReady,
      "VideoID:",
      youtubeVideoId,
      "Error:",
      lastYoutubeError
    );
    if (isYouTubePlayerReady && youtubeVideoId && !lastYoutubeError) {
      console.log("Calling playVideo() for ID:", youtubeVideoId);
      youtubeStatus.textContent = "재생 시도 중...";
      youtubePlayer.playVideo();
      youtubeShouldBePlaying = true;
    } else if (lastYoutubeError) {
      console.warn("Cannot play, previous error exists:", lastYoutubeError);
      handleYoutubeError(lastYoutubeError);
    } else if (!isYouTubePlayerReady) {
      console.warn("Cannot play, player not ready.");
      youtubeStatus.textContent = "플레이어 준비 안됨";
    } else if (!youtubeVideoId) {
      console.warn("Cannot play, no video ID loaded.");
      youtubeStatus.textContent = "로드된 오디오 없음";
    }
  }
  function pauseYouTubeAudio() {
    if (
      isYouTubePlayerReady &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      console.log("Calling pauseVideo()");
      youtubePlayer.pauseVideo();
    }
    youtubeShouldBePlaying = false;
    if (!youtubePausedForNotification && isYouTubePlayerReady) {
      /* 상태는 onStateChange에서 업데이트 */
    }
  }
  function resumeYouTubeAudio() {
    if (
      isYouTubePlayerReady &&
      (timerInterval || isPaused) &&
      !lastYoutubeError
    ) {
      console.log("Attempting to resume YouTube audio...");
      playYouTubeAudio();
    } else {
      console.log(
        "Cannot resume YouTube audio. Player ready:",
        isYouTubePlayerReady,
        "Timer running/paused:",
        timerInterval || isPaused,
        "Error:",
        lastYoutubeError
      );
    }
  }
  function stopYouTubeAudio() {
    if (isYouTubePlayerReady && !lastYoutubeError) {
      console.log("Calling stopVideo()");
      try {
        youtubePlayer.stopVideo();
      } catch (e) {
        console.error("Error calling stopVideo:", e);
        if (youtubePlayer.pauseVideo) youtubePlayer.pauseVideo();
        if (youtubePlayer.seekTo) youtubePlayer.seekTo(0);
      }
    }
    youtubeShouldBePlaying = false;
    youtubePausedForNotification = false;
    if (!lastYoutubeError) {
      youtubeStatus.textContent = "정지됨";
    }
  }
  loadYoutubeButton.addEventListener("click", loadYouTubeVideo);

  // --- 타이머 로직 ---
  function startTimer() {
    if (timerInterval || delayInterval) return;
    isPaused = false;
    setControlsState(true);
    const delaySeconds = parseInt(delayInput.value);
    if (remainingSeconds <= 0) {
      currentTimerMode = "work";
      pomodoroCycleCount = 0;
      resetTimerSettings();
      notificationShown = false;
    }
    const notifySecondsBeforeEnd = parseInt(notifyInput.value) * 60;
    if (delaySeconds > 0 && !isPaused) {
      delayRemainingSeconds = delaySeconds;
      notificationArea.textContent = `${delayRemainingSeconds}...`;
      clearInterval(delayInterval);
      delayInterval = setInterval(() => {
        delayRemainingSeconds--;
        if (delayRemainingSeconds > 0) {
          notificationArea.textContent = `${delayRemainingSeconds}...`;
        } else {
          clearInterval(delayInterval);
          delayInterval = null;
          notificationArea.textContent = "";
          if (!isPaused) {
            if (youtubeVideoId) playYouTubeAudio();
            runInterval(notifySecondsBeforeEnd);
          }
        }
      }, 1000);
    } else {
      notificationArea.textContent = "";
      if (youtubeVideoId && !isPaused && !lastYoutubeError) {
        playYouTubeAudio();
      } else if (youtubeVideoId && isPaused && !lastYoutubeError) {
        resumeYouTubeAudio();
      }
      runInterval(notifySecondsBeforeEnd);
    }
  }
  function runInterval(notifySecondsBeforeEnd) {
    updateTimerDisplay();
    updateBackground();
    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();
      updateBackground();
      // ★ "X분 전" 알림 로직 수정
      if (
        !notificationShown &&
        notifySecondsBeforeEnd > 0 &&
        remainingSeconds === notifySecondsBeforeEnd &&
        remainingSeconds < totalDurationSeconds
      ) {
        triggerNotification(
          `종료 ${Math.round(notifySecondsBeforeEnd / 60)}분 전입니다!`,
          "minutesBefore"
        ); // ★ 컨텍스트 전달
      }
      if (remainingSeconds < 0) {
        handleTimerEnd();
      }
    }, 1000);
  }
  function handleTimerEnd() {
    clearInterval(timerInterval);
    timerInterval = null;
    remainingSeconds = 0;
    const breakMinutes = parseInt(breakDurationInput.value);
    let finalMessage = "시간 종료!";
    // ★ 타이머 종료 알림 로직 수정
    triggerNotification(finalMessage, "final"); // ★ 컨텍스트 전달 (메시지는 실제 사용 안 함)

    if (currentTimerMode === "work") {
      finalMessage = "집중 시간 종료!";
      /* 화면 표시용 메시지 (알림과 별개) */ pomodoroCycleCount++;
      if (breakMinutes > 0) {
        currentTimerMode = "break";
        timerStatus.textContent = "휴식 시간";
        resetTimerSettings();
        startTimer();
      } else {
        stopYouTubeAudio();
        timerStatus.textContent = "완료";
        resetControlsState();
      }
    } else {
      finalMessage = "휴식 시간 종료!";
      /* 화면 표시용 메시지 */ currentTimerMode = "work";
      timerStatus.textContent = `집중 시간 (${pomodoroCycleCount + 1}번째)`;
      resetTimerSettings();
      startTimer();
    }
    // 필요하다면 화면에 종료 메시지 표시 (알림과는 별도로)
    // showNotificationOnScreen(finalMessage); // 이 함수는 현재 주석처리되어 있음
  }
  function pauseTimer() {
    if (delayInterval) {
      clearInterval(delayInterval);
      delayInterval = null;
      isPaused = true;
      showNotificationOnScreen("시작 지연 중지됨. '재개'를 누르세요.");
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
      pauseButton.disabled = false;
      resetButton.disabled = false;
    } else if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      isPaused = true;
      timerStatus.textContent += " (일시정지됨)";
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
      pauseYouTubeAudio();
    } else if (isPaused) {
      isPaused = false;
      timerStatus.textContent = timerStatus.textContent.replace(
        " (일시정지됨)",
        ""
      );
      pauseButton.textContent = "일시정지";
      pauseButton.classList.remove("resume");
      notificationArea.textContent = "";
      startTimer();
    }
  }
  function resetTimer() {
    clearInterval(timerInterval);
    clearInterval(delayInterval);
    timerInterval = null;
    delayInterval = null;
    isPaused = false;
    notificationShown = false;
    remainingSeconds = 0;
    totalDurationSeconds = 0;
    currentTimerMode = "work";
    pomodoroCycleCount = 0;
    delayRemainingSeconds = 0;
    youtubePausedForNotification = false;
    stopYouTubeAudio();
    resetControlsState();
    resetTimerSettings();
    updateTimerDisplay();
    updateBackground();
    notificationArea.textContent = "";
    timerStatus.textContent = "대기 중";
    hideModal();
  }
  function resetTimerSettings() {
    const workM = parseInt(workDurationInput.value),
      breakM = parseInt(breakDurationInput.value);
    totalDurationSeconds =
      currentTimerMode === "work" ? workM * 60 : breakM * 60;
    if (remainingSeconds <= 0) {
      remainingSeconds = totalDurationSeconds;
    }
  }

  // --- UI 및 컨트롤 상태 관리 ---
  function setControlsState(isRunning) {
    if (isRunning) {
      body.classList.add("timer-running");
    } else {
      body.classList.remove("timer-running");
    }
    startButton.disabled = isRunning;
    pauseButton.disabled = !isRunning && !isPaused;
    resetButton.disabled = false;
    const settingElements = document.querySelectorAll(
      ".settings-area input, .settings-area select, .settings-area button"
    );
    settingElements.forEach(
      (el) => (el.disabled = isRunning || isPaused || delayInterval !== null)
    );
    if (isPaused) {
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
    } else {
      pauseButton.textContent = "일시정지";
      pauseButton.classList.remove("resume");
    }
  }
  function resetControlsState() {
    setControlsState(false);
    pauseButton.textContent = "일시정지";
    pauseButton.classList.remove("resume");
    pauseButton.disabled = true;
  }

  // --- 이벤트 리스너 ---
  imageUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        userImageSrc = e.target.result;
        backgroundImage.src = userImageSrc;
        backgroundImage.onload = () => {
          console.log("Image loaded successfully.");
          backgroundImage.style.display = "block";
          if (
            backgroundTypeSelect.value === "imageFade" &&
            !timerInterval &&
            !delayInterval &&
            !isPaused
          ) {
            updateBackground();
          }
        };
        backgroundImage.onerror = () => {
          console.error("Failed to load uploaded image.");
          userImageSrc = null;
          backgroundImage.style.display = "none";
          if (
            backgroundTypeSelect.value === "imageFade" &&
            !timerInterval &&
            !delayInterval &&
            !isPaused
          ) {
            updateBackground();
          }
        };
      };
      reader.readAsDataURL(file);
    } else {
      alert("이미지 파일만 선택 가능합니다.");
      imageUpload.value = "";
    }
  });
  function handleBackgroundSettingChange() {
    const selectedType = backgroundTypeSelect.value;
    colorFadeOptionsContainer.style.display =
      selectedType === "colorFade" ? "flex" : "none";
    imageUploadContainer.style.display =
      selectedType === "imageFade" ? "flex" : "none";
    if (!timerInterval && !delayInterval && !isPaused) {
      updateBackground();
    }
  }
  backgroundTypeSelect.addEventListener(
    "change",
    handleBackgroundSettingChange
  );
  startColorPicker.addEventListener("input", handleBackgroundSettingChange);
  endColorPicker.addEventListener("input", handleBackgroundSettingChange);
  [
    workDurationInput,
    breakDurationInput,
    delayInput,
    notifyInput,
    notificationTypeSelect,
  ].forEach((el) => {
    el.addEventListener("change", () => {
      if (!timerInterval && !delayInterval && !isPaused) {
        resetTimer();
      } else {
        console.warn("타이머 실행 중 설정 변경 불가");
      }
    });
  });
  startButton.addEventListener("click", startTimer);
  pauseButton.addEventListener("click", pauseTimer);
  resetButton.addEventListener("click", resetTimer);

  // --- 초기화 ---
  updateCurrentTime();
  currentTimeInterval = setInterval(updateCurrentTime, 1000);
  handleBackgroundSettingChange();
  resetTimer();

  // --- AudioContext 초기화 리스너 ---
  function initializeAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext initialized.");
      } catch (e) {
        console.error("Failed to initialize AudioContext:", e);
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(() => {
          console.log("AudioContext resumed successfully.");
        })
        .catch((e) => console.error("AudioContext resume error:", e));
    }
    document.body.removeEventListener("click", initializeAudioContext);
    document.body.removeEventListener("touchstart", initializeAudioContext);
  }
  document.body.addEventListener("click", initializeAudioContext);
  document.body.addEventListener("touchstart", initializeAudioContext);
}); // End DOMContentLoaded
