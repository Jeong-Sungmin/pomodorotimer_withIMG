// === YouTube IFrame Player API 로딩 ===
var youtubePlayer;
var youtubeVideoId = null;
var youtubeVideoDuration = 0;
var isYouTubeApiReady = false;
var isYouTubePlayerReady = false;
var youtubeShouldBePlaying = false;
var youtubePausedForNotification = false;
var lastYoutubeError = null; // ★ 유튜브 오류 코드 저장

function onYouTubeIframeAPIReady() {
  isYouTubeApiReady = true;
  // console.log("YouTube API Ready");
}

function onPlayerReady(event) {
  isYouTubePlayerReady = true;
  youtubeVideoDuration = event.target.getDuration();
  document.getElementById(
    "youtubeStatus"
  ).textContent = `오디오 로드됨 (${formatTime(youtubeVideoDuration)})`;
  lastYoutubeError = null; // 성공 시 오류 초기화
  if (youtubeShouldBePlaying) {
    playYouTubeAudio();
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    if (youtubeShouldBePlaying) {
      youtubePlayer.seekTo(0);
      youtubePlayer.playVideo();
    }
  }
  // 에러 발생 시 상태 업데이트 (재생 불가 등)
  if (event.data === -1 && lastYoutubeError) {
    // unstarted 상태 + 에러 발생 시
    handleYoutubeError(lastYoutubeError);
  }
}

// ★ YouTube 플레이어 에러 핸들러
function onPlayerError(event) {
  console.error("YouTube Player Error:", event.data);
  lastYoutubeError = event.data; // 에러 코드 저장
  handleYoutubeError(event.data);
}

// ★ YouTube 오류 처리 및 상태 메시지 업데이트 함수
function handleYoutubeError(errorCode) {
  let errorMsg = "오디오 로드/재생 실패";
  switch (errorCode) {
    case 2:
      errorMsg = "잘못된 파라미터 (링크 오류)";
      break;
    case 5:
      errorMsg = "HTML5 플레이어 오류";
      break;
    case 100:
      errorMsg = "비디오 없음/비공개";
      break;
    case 101:
    case 150:
      errorMsg = "재생 권한 없음 (임베딩 불가)";
      break;
    default:
      errorMsg = `로드/재생 실패 (코드: ${errorCode})`;
  }
  document.getElementById("youtubeStatus").textContent = errorMsg;
  youtubeVideoId = null; // 오류 발생 시 ID 초기화
  isYouTubePlayerReady = false; // 플레이어 사용 불가
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
  const backgroundTypeSelect = document.getElementById("backgroundType"); // ★ ID 변경
  const colorPickerContainer = document.getElementById("colorPickerContainer"); // ★ 단색 선택기 컨테이너
  const colorPicker = document.getElementById("colorPicker"); // ★ 단색 선택기
  const imageUploadContainer = document.getElementById("imageUploadContainer");
  const imageUpload = document.getElementById("imageUpload");
  const progressVisualizer = document.getElementById("progressVisualizer"); // ★ 배경색 적용 대상
  const fadeOverlay = document.getElementById("fadeOverlay");
  const imageEffectContainer = document.getElementById("imageEffectContainer");
  const backgroundImage = document.getElementById("backgroundImage");
  const imageOverlay = document.getElementById("imageOverlay");
  const youtubeUrlInput = document.getElementById("youtubeUrl");
  const loadYoutubeButton = document.getElementById("loadYoutubeButton");
  const youtubeStatus = document.getElementById("youtubeStatus");
  const modal = document.getElementById("notificationModal");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalMessage = document.getElementById("modalMessage");
  const modalCloseButton = document.getElementById("modalCloseButton");

  // --- 상태 변수 ---
  let timerInterval = null;
  let delayInterval = null;
  let delayRemainingSeconds = 0;
  let currentTimeInterval = null;
  let totalDurationSeconds = 0;
  let remainingSeconds = 0;
  let currentTimerMode = "work";
  let pomodoroCycleCount = 0;
  let isPaused = false;
  let notificationShown = false;
  let audioContext = null;
  let userImageSrc = null;
  let currentBackgroundColor = colorPicker.value; // ★ 현재 배경색 저장

  // --- 기본 함수 ---
  function formatTime(seconds) {
    /* 이전과 동일 */
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  function updateCurrentTime() {
    /* 이전과 동일 */
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    currentTimeDisplay.textContent = `${h}:${m}:${s}`;
  }
  function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
  }

  // --- ★ 배경화면 업데이트 (수정됨) ---
  function updateBackground() {
    const elapsedSeconds = totalDurationSeconds - remainingSeconds;
    let progressPercentage =
      totalDurationSeconds > 0
        ? (elapsedSeconds / totalDurationSeconds) * 100
        : 0;
    if (progressPercentage > 100) progressPercentage = 100;
    if (progressPercentage < 0) progressPercentage = 0; // 음수 방지

    const selectedType = backgroundTypeSelect.value;
    const selectedColor = colorPicker.value;
    currentBackgroundColor = selectedColor; // 현재 선택된 색상 저장

    // 모든 시각 요소 초기화 (매번 호출 시)
    fadeOverlay.style.display = "none";
    fadeOverlay.style.height = "100%"; // 페이드 초기 상태
    imageEffectContainer.style.display = "none";
    imageOverlay.style.height = "100%"; // 이미지 오버레이 초기 상태
    backgroundImage.style.display = "none"; // 이미지 숨김
    progressVisualizer.style.backgroundColor = selectedColor; // 기본 배경은 선택된 색상

    let useType = selectedType;

    // 이미지 타입 처리
    if (useType === "image") {
      const isImageAvailable =
        userImageSrc &&
        backgroundImage.src === userImageSrc &&
        backgroundImage.complete &&
        backgroundImage.naturalWidth !== 0;
      if (isImageAvailable) {
        imageEffectContainer.style.display = "block";
        backgroundImage.style.display = "block";
        imageOverlay.style.height = `${100 - progressPercentage}%`;
        // 이미지 배경일 때는 progressVisualizer 배경을 투명하게? or 흰색? 일단 유지.
      } else {
        // 이미지 없으면 단색 타입으로 강제 변경 (선택된 색상 사용)
        useType = "color";
        if (userImageSrc) {
          // 시도는 했으나 실패한 경우
          console.warn("이미지 로드 실패. 단색 배경으로 대체합니다.");
        }
      }
    }

    // 단색 타입 처리 (이미지 실패 시 여기로 옴)
    if (useType === "color") {
      progressVisualizer.style.backgroundColor = selectedColor; // 선택된 색상 적용
      // 오버레이 등은 이미 숨겨진 상태
    }

    // 페이드 타입 처리
    if (useType === "fade") {
      progressVisualizer.style.backgroundColor = "#ffffff"; // 페이드는 흰색 배경 기준
      fadeOverlay.style.display = "block";
      fadeOverlay.style.height = `${100 - progressPercentage}%`;
    }
  }

  // --- 오디오 및 알림 함수 ---
  function playBeepFallback() {
    /* 이전과 동일 */
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
    /* 이전과 동일 */
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
    modalOverlay.style.display = "none";
    modal.style.display = "none";
    if (youtubePausedForNotification) {
      resumeYouTubeAudio();
      youtubePausedForNotification = false;
    }
  }
  modalCloseButton.addEventListener("click", hideModal);
  modalOverlay.addEventListener("click", hideModal);

  function triggerNotification(message, isFinal = false) {
    /* 유튜브 일시정지 로직 포함 (이전과 동일) */
    const type = notificationTypeSelect.value;
    let pauseYoutube = type === "popup" || type === "beep" || type === "speech";
    if (
      pauseYoutube &&
      isYouTubePlayerReady &&
      youtubeShouldBePlaying &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      youtubePlayer.pauseVideo();
      youtubePausedForNotification = true;
    } else {
      youtubePausedForNotification = false;
    }
    if (type === "popup") {
      showModal(message);
    } else if (type === "beep") {
      playBeepFallback();
      if (youtubePausedForNotification) {
        setTimeout(() => {
          if (youtubePausedForNotification) {
            resumeYouTubeAudio();
            youtubePausedForNotification = false;
          }
        }, 300);
      }
    } else if (type === "speech") {
      triggerSpeech(message);
      if (youtubePausedForNotification) {
        setTimeout(() => {
          if (youtubePausedForNotification) {
            resumeYouTubeAudio();
            youtubePausedForNotification = false;
          }
        }, 2000);
      }
    }
    notificationShown = !isFinal;
  }

  // --- 유튜브 관련 함수 ---
  function extractVideoID(url) {
    /* 이전과 동일 */
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
    const match = regex.exec(url);
    return match ? match[1] : null;
  }
  function loadYouTubeVideo() {
    /* 에러 핸들러 추가 */
    if (!isYouTubeApiReady) {
      alert("YouTube API 준비 안됨");
      return;
    }
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoID(url);
    if (!videoId) {
      alert("유효한 유튜브 링크 입력");
      youtubeStatus.textContent = "잘못된 링크";
      return;
    }
    youtubeVideoId = videoId;
    isYouTubePlayerReady = false;
    lastYoutubeError = null; // 에러 초기화
    youtubeStatus.textContent = "오디오 로딩 중...";
    if (youtubePlayer) {
      console.log("Loading new video:", youtubeVideoId);
      youtubePlayer.cueVideoById(videoId);
      // 기존 플레이어 객체에 이벤트 핸들러가 이미 등록되어 있으므로 재등록 불필요
    } else {
      console.log("Creating YouTube player for:", youtubeVideoId);
      youtubePlayer = new YT.Player("youtube-player", {
        height: "1",
        width: "1",
        videoId: videoId,
        playerVars: { playsinline: 1 },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        }, // ★ onError 추가
      });
    }
  }
  function playYouTubeAudio() {
    if (isYouTubePlayerReady && youtubeVideoId && !lastYoutubeError) {
      youtubePlayer.playVideo();
      youtubeShouldBePlaying = true;
    } else if (lastYoutubeError) {
      handleYoutubeError(lastYoutubeError); /* 에러 상태면 메시지 재표시 */
    }
  }
  function pauseYouTubeAudio() {
    if (
      isYouTubePlayerReady &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      youtubePlayer.pauseVideo();
    }
    youtubeShouldBePlaying = false;
  }
  function resumeYouTubeAudio() {
    if (
      isYouTubePlayerReady &&
      (timerInterval || isPaused) &&
      !lastYoutubeError
    ) {
      playYouTubeAudio();
    }
  }
  function stopYouTubeAudio() {
    if (isYouTubePlayerReady && !lastYoutubeError) {
      youtubePlayer.stopVideo();
    }
    youtubeShouldBePlaying = false;
    youtubePausedForNotification = false;
  }
  loadYoutubeButton.addEventListener("click", loadYouTubeVideo);

  // --- 타이머 로직 ---
  function startTimer() {
    /* 유튜브 재생 시작 로직 수정 */
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
      } // ★ 에러 없을 때만 재생 시도
      else if (youtubeVideoId && isPaused && !lastYoutubeError) {
        resumeYouTubeAudio();
      }
      runInterval(notifySecondsBeforeEnd);
    }
  }
  function runInterval(notifySecondsBeforeEnd) {
    /* 배경 업데이트 호출 */
    updateTimerDisplay();
    updateBackground(); // ★ 배경 즉시 업데이트
    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();
      updateBackground(); // ★ 매초 배경 업데이트
      if (
        !notificationShown &&
        notifySecondsBeforeEnd > 0 &&
        remainingSeconds === notifySecondsBeforeEnd &&
        remainingSeconds < totalDurationSeconds
      ) {
        triggerNotification(
          `종료 ${Math.round(notifySecondsBeforeEnd / 60)}분 전입니다!`
        );
      }
      if (remainingSeconds < 0) {
        handleTimerEnd();
      }
    }, 1000);
  }
  function handleTimerEnd() {
    /* 이전과 동일 (유튜브 정지 포함) */
    clearInterval(timerInterval);
    timerInterval = null;
    remainingSeconds = 0;
    const breakMinutes = parseInt(breakDurationInput.value);
    let finalMessage = "시간 종료!";
    if (currentTimerMode === "work") {
      finalMessage = "집중 시간 종료!";
      triggerNotification(finalMessage, true);
      pomodoroCycleCount++;
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
      triggerNotification(finalMessage, true);
      currentTimerMode = "work";
      timerStatus.textContent = `집중 시간 (${pomodoroCycleCount + 1}번째)`;
      resetTimerSettings();
      startTimer();
    }
  }
  function pauseTimer() {
    /* 이전과 동일 (유튜브 일시정지 포함) */
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
    /* 배경 업데이트 호출 */
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
    updateBackground(); // ★ 배경 업데이트
    notificationArea.textContent = "";
    timerStatus.textContent = "대기 중";
    hideModal();
  }
  function resetTimerSettings() {
    /* 이전과 동일 */
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
    /* 이전과 동일 */
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
    /* 이전과 동일 */
    setControlsState(false);
    pauseButton.textContent = "일시정지";
    pauseButton.classList.remove("resume");
    pauseButton.disabled = true;
  }

  // --- 이벤트 리스너 ---
  imageUpload.addEventListener("change", (event) => {
    /* 이전과 동일 */
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        userImageSrc = e.target.result;
        backgroundImage.src = userImageSrc;
        backgroundImage.style.display = "block";
        if (
          backgroundTypeSelect.value === "image" &&
          !timerInterval &&
          !delayInterval &&
          !isPaused
        ) {
          updateBackground();
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("이미지 파일만 선택 가능합니다.");
      imageUpload.value = "";
    }
  });

  // ★ 배경 타입/색상 변경 리스너 수정
  function handleBackgroundSettingChange() {
    const selectedType = backgroundTypeSelect.value;
    colorPickerContainer.style.display =
      selectedType === "color" ? "flex" : "none";
    imageUploadContainer.style.display =
      selectedType === "image" ? "flex" : "none";
    // 타이머 멈춰있을 때만 배경 즉시 업데이트
    if (!timerInterval && !delayInterval && !isPaused) {
      updateBackground();
    }
  }
  backgroundTypeSelect.addEventListener(
    "change",
    handleBackgroundSettingChange
  );
  colorPicker.addEventListener("input", handleBackgroundSettingChange); // 색상 변경 시 실시간 반영

  // 나머지 설정 변경 리스너
  [
    workDurationInput,
    breakDurationInput,
    delayInput,
    notifyInput,
    notificationTypeSelect,
  ].forEach((el) => {
    /* 이전과 동일 */
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
  handleBackgroundSettingChange(); // ★ 초기 로드 시 배경 옵션 표시 설정
  resetTimer(); // ★ 초기화 (내부에서 updateBackground 호출)

  // --- AudioContext 초기화 리스너 ---
  function initializeAudioContext() {
    /* 이전과 동일 */
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
