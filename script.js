// === YouTube IFrame Player API 로딩 ===
var youtubePlayer;
var youtubeVideoId = null;
var youtubeVideoDuration = 0;
var isYouTubeApiReady = false;
var isYouTubePlayerReady = false;
var youtubeShouldBePlaying = false; // 타이머 상태에 따라 유튜브 재생 여부
var youtubePausedForNotification = false; // 알림 때문에 일시정지되었는지 여부

// API 로드 완료 시 호출될 전역 콜백 함수
function onYouTubeIframeAPIReady() {
  isYouTubeApiReady = true;
  // 로드 버튼을 눌렀을 때 플레이어를 생성하도록 변경
  // console.log("YouTube API Ready");
}

// 플레이어 준비 완료 시 호출될 함수
function onPlayerReady(event) {
  isYouTubePlayerReady = true;
  youtubeVideoDuration = event.target.getDuration();
  document.getElementById(
    "youtubeStatus"
  ).textContent = `오디오 로드됨 (${formatTime(youtubeVideoDuration)})`;
  // console.log("YouTube Player Ready. Duration:", youtubeVideoDuration);
  // 타이머가 이미 실행 중이고 유튜브 재생이 필요하면 바로 재생
  if (youtubeShouldBePlaying) {
    playYouTubeAudio();
  }
}

// 플레이어 상태 변경 시 호출될 함수 (반복 재생 처리)
function onPlayerStateChange(event) {
  // console.log("Player State Change:", event.data);
  if (event.data === YT.PlayerState.ENDED) {
    // 타이머가 계속 실행 중이고 루프가 필요할 때 (혹은 무조건 루프)
    if (youtubeShouldBePlaying) {
      // 타이머가 끝나면 루프 중지
      console.log("Video ended, looping...");
      youtubePlayer.seekTo(0); // 처음으로 되감기
      youtubePlayer.playVideo(); // 다시 재생
    } else {
      console.log("Video ended, timer finished. Stopping loop.");
    }
  }
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
  const visualEffectTypeSelect = document.getElementById("visualEffectType");
  const imageUploadContainer = document.getElementById("imageUploadContainer");
  const imageUpload = document.getElementById("imageUpload");
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

  // --- 기본 함수 ---
  function formatTime(seconds) {
    // 시간 포맷 함수 추가
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function updateCurrentTime() {
    /* 이전과 동일 */
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }

  function updateTimerDisplay() {
    /* 타이머 디스플레이 업데이트 */
    timerDisplay.textContent = formatTime(remainingSeconds);
  }

  function updateVisualProgress() {
    /* 이전과 동일 (사용자 이미지 처리 포함) */
    const elapsedSeconds = totalDurationSeconds - remainingSeconds;
    let progressPercentage =
      totalDurationSeconds > 0
        ? (elapsedSeconds / totalDurationSeconds) * 100
        : 0;
    if (progressPercentage > 100) progressPercentage = 100;
    let useEffect = visualEffectTypeSelect.value;
    let currentImageSrc = userImageSrc;
    const isImageAvailable =
      currentImageSrc &&
      backgroundImage.src === currentImageSrc &&
      backgroundImage.complete &&
      backgroundImage.naturalWidth !== 0;
    if (useEffect === "image" && !isImageAvailable) {
      useEffect = "fade";
    }
    fadeOverlay.style.display = useEffect === "fade" ? "block" : "none";
    imageEffectContainer.style.display =
      useEffect === "image" ? "block" : "none";
    backgroundImage.style.display = useEffect === "image" ? "block" : "none";
    if (useEffect === "fade") {
      fadeOverlay.style.height = `${100 - progressPercentage}%`;
    } else {
      imageOverlay.style.height = `${100 - progressPercentage}%`;
    }
  }

  // --- 오디오 및 알림 함수 ---
  function playBeepFallback() {
    /* Web Audio API 삐 소리 */
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
    // 음성 합성 함수 분리
    if (
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    ) {
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "ko-KR";
        utterance.onerror = (event) => {
          console.error("음성 합성 오류:", event.error);
          playBeepFallback();
        }; // 실패 시 삐 소리
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("음성 합성 시작 오류:", error);
        playBeepFallback();
      }
    } else {
      console.warn(
        "브라우저가 음성 합성을 지원하지 않습니다. 삐 소리로 대체합니다."
      );
      playBeepFallback();
    }
  }

  function showModal(message) {
    // ★ 모달 표시 함수
    modalMessage.textContent = message;
    modalOverlay.style.display = "block";
    modal.style.display = "block";
  }

  function hideModal() {
    // ★ 모달 숨김 함수
    modalOverlay.style.display = "none";
    modal.style.display = "none";
    // ★ 모달 닫힐 때, 알림 때문에 유튜브가 멈췄었다면 재개
    if (youtubePausedForNotification) {
      resumeYouTubeAudio();
      youtubePausedForNotification = false; // 플래그 리셋
    }
  }

  modalCloseButton.addEventListener("click", hideModal);
  modalOverlay.addEventListener("click", hideModal); // 오버레이 클릭 시 닫기

  // --- ★ 알림 처리 (팝업/소리/음성 분기, 유튜브 일시정지) ---
  function triggerNotification(message, isFinal = false) {
    const type = notificationTypeSelect.value;
    let pauseYoutube = false; // 유튜브를 멈춰야 하는 알림인가?

    if (type === "popup") {
      pauseYoutube = true; // 팝업은 유튜브를 멈춤
    } else if (type === "beep" || type === "speech") {
      pauseYoutube = true; // 소리/음성 알림도 유튜브를 잠시 멈춤
    }
    // 'text'는 이제 없음 ('popup'으로 대체)

    // 알림 발생 전 유튜브 상태 확인 및 일시정지
    if (
      pauseYoutube &&
      isYouTubePlayerReady &&
      youtubeShouldBePlaying &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      console.log("Pausing YouTube for notification...");
      youtubePlayer.pauseVideo();
      youtubePausedForNotification = true; // 플래그 설정
    } else {
      youtubePausedForNotification = false; // 유튜브를 멈추지 않았거나 멈출 필요 없음
    }

    // 알림 실행
    if (type === "popup") {
      showModal(message);
    } else if (type === "beep") {
      playBeepFallback();
      // 비동기 소리 재생 후 유튜브 재개 (즉시 재개해도 큰 문제 없을 수 있음)
      if (youtubePausedForNotification) {
        setTimeout(() => {
          if (youtubePausedForNotification) {
            // 여전히 플래그가 true면 재개
            resumeYouTubeAudio();
            youtubePausedForNotification = false;
          }
        }, 300); // 0.3초 후 재개 시도
      }
    } else if (type === "speech") {
      triggerSpeech(message);
      // 음성 합성 종료 시점을 정확히 알기 어려우므로, 일정 시간 후 재개 시도 (개선 필요)
      // utterance.onend 이벤트를 사용하면 더 정확하나 복잡해짐
      if (youtubePausedForNotification) {
        setTimeout(() => {
          if (youtubePausedForNotification) {
            resumeYouTubeAudio();
            youtubePausedForNotification = false;
          }
        }, 2000); // 2초 후 재개 시도 (메시지 길이에 따라 조정 필요)
      }
    }

    notificationShown = !isFinal;
  }

  // --- 유튜브 관련 함수 ---
  function extractVideoID(url) {
    // 유튜브 ID 추출 함수
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
    const match = regex.exec(url);
    return match ? match[1] : null;
  }

  function loadYouTubeVideo() {
    // 유튜브 비디오 로드 (플레이어 생성 또는 ID 변경)
    if (!isYouTubeApiReady) {
      alert("YouTube API가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoID(url);

    if (!videoId) {
      alert("유효한 유튜브 링크를 입력해주세요.");
      youtubeStatus.textContent = "잘못된 링크";
      return;
    }

    youtubeVideoId = videoId; // 비디오 ID 저장
    isYouTubePlayerReady = false; // 플레이어 상태 초기화
    youtubeStatus.textContent = "오디오 로딩 중...";

    if (youtubePlayer) {
      // 이미 플레이어가 있으면 비디오만 변경
      youtubePlayer.cueVideoById(youtubeVideoId); // cueVideoById 또는 loadVideoById
      console.log("Loading new video:", youtubeVideoId);
      // 로드 후 onReady가 다시 트리거되지 않을 수 있으므로, 상태 변화를 감지하여 duration 업데이트 필요
      // 여기서는 단순화를 위해 onReady에서만 duration 설정
    } else {
      // 플레이어 새로 생성
      console.log("Creating YouTube player for:", youtubeVideoId);
      youtubePlayer = new YT.Player("youtube-player", {
        height: "1", // 매우 작게 (숨김)
        width: "1",
        videoId: youtubeVideoId,
        playerVars: {
          playsinline: 1, // 모바일 인라인 재생
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    }
    // 로드 후 URL 입력 필드는 그대로 두거나 비울 수 있음
    // youtubeUrlInput.value = '';
  }

  function playYouTubeAudio() {
    // 유튜브 오디오 재생
    if (isYouTubePlayerReady && youtubeVideoId) {
      youtubePlayer.playVideo();
      console.log("Playing YouTube Audio");
      youtubeShouldBePlaying = true; // 재생 상태 플래그 설정
    }
  }

  function pauseYouTubeAudio() {
    // 유튜브 오디오 일시정지
    if (
      isYouTubePlayerReady &&
      youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING
    ) {
      youtubePlayer.pauseVideo();
      console.log("Pausing YouTube Audio");
    }
    youtubeShouldBePlaying = false; // 재생 상태 플래그 해제
  }

  function resumeYouTubeAudio() {
    // 유튜브 오디오 재개
    // 타이머가 여전히 실행 중이거나, 일시정지 상태가 아니라면 재생
    if (isYouTubePlayerReady && (timerInterval || isPaused)) {
      // 타이머가 완전히 멈춘게 아니라면 재개 시도
      // pausedForNotification 플래그는 호출하는 쪽에서 해제
      playYouTubeAudio(); // playVideo 호출 및 플래그 설정
      console.log("Resuming YouTube Audio");
    }
  }

  function stopYouTubeAudio() {
    // 유튜브 오디오 정지
    if (isYouTubePlayerReady) {
      youtubePlayer.stopVideo(); // 비디오 정지 및 로딩 상태로 돌아감
      console.log("Stopping YouTube Audio");
    }
    youtubeShouldBePlaying = false;
    youtubePausedForNotification = false;
  }

  loadYoutubeButton.addEventListener("click", loadYouTubeVideo);

  // --- 타이머 로직 ---
  function startTimer() {
    if (timerInterval || delayInterval) return;
    isPaused = false;
    setControlsState(true); // UI 변경
    const delaySeconds = parseInt(delayInput.value);

    if (remainingSeconds <= 0) {
      // 새로 시작 시 초기화
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
            if (youtubeVideoId) playYouTubeAudio(); // ★ 지연 후 유튜브 재생 시작
            runInterval(notifySecondsBeforeEnd);
          }
        }
      }, 1000);
    } else {
      // 지연 0 또는 재개 시
      notificationArea.textContent = "";
      if (youtubeVideoId && !isPaused)
        playYouTubeAudio(); // ★ 지연 0일 때 유튜브 재생 시작
      else if (youtubeVideoId && isPaused) resumeYouTubeAudio(); // ★ 일시정지 해제 시 유튜브 재개
      runInterval(notifySecondsBeforeEnd);
    }
  }

  function runInterval(notifySecondsBeforeEnd) {
    updateTimerDisplay();
    updateVisualProgress();
    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();
      updateVisualProgress();
      if (
        !notificationShown &&
        notifySecondsBeforeEnd > 0 &&
        remainingSeconds === notifySecondsBeforeEnd &&
        remainingSeconds < totalDurationSeconds
      ) {
        triggerNotification(
          `종료 ${Math.round(notifySecondsBeforeEnd / 60)}분 전입니다!`
        ); // ★ 수정된 알림 호출
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

    if (currentTimerMode === "work") {
      finalMessage = "집중 시간 종료!";
      triggerNotification(finalMessage, true);
      pomodoroCycleCount++;
      if (breakMinutes > 0) {
        currentTimerMode = "break";
        timerStatus.textContent = "휴식 시간";
        resetTimerSettings();
        // 휴식 시간에는 유튜브 멈춤 (선택적)
        // pauseYouTubeAudio();
        startTimer(); // 자동으로 휴식 시작
      } else {
        stopYouTubeAudio(); // ★ 타이머 완전 종료 시 유튜브 정지
        timerStatus.textContent = "완료";
        resetControlsState();
      }
    } else {
      // 'break' 모드 종료
      finalMessage = "휴식 시간 종료!";
      triggerNotification(finalMessage, true);
      currentTimerMode = "work";
      timerStatus.textContent = `집중 시간 (${pomodoroCycleCount + 1}번째)`;
      resetTimerSettings();
      // 집중 시간 시작 시 유튜브 재개 또는 새로 시작
      // playYouTubeAudio(); // startTimer 내부에서 처리됨
      startTimer(); // 자동으로 다음 집중 시작
    }
  }

  function pauseTimer() {
    if (delayInterval) {
      // 지연 중 일시정지
      clearInterval(delayInterval);
      delayInterval = null;
      isPaused = true;
      showNotificationOnScreen("시작 지연 중지됨. '재개'를 누르세요.");
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
      // UI 상태는 setControlsState에서 관리
      pauseButton.disabled = false;
      resetButton.disabled = false; // 명시적 활성화
    } else if (timerInterval) {
      // 실행 중 일시정지
      clearInterval(timerInterval);
      timerInterval = null;
      isPaused = true;
      timerStatus.textContent += " (일시정지됨)";
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
      pauseYouTubeAudio(); // ★ 타이머 일시정지 시 유튜브도 일시정지
    } else if (isPaused) {
      // 재개
      isPaused = false;
      timerStatus.textContent = timerStatus.textContent.replace(
        " (일시정지됨)",
        ""
      );
      pauseButton.textContent = "일시정지";
      pauseButton.classList.remove("resume");
      notificationArea.textContent = "";
      // resumeYouTubeAudio(); // ★ startTimer 내부에서 처리됨
      startTimer(); // 타이머 재개
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
    youtubePausedForNotification = false; // ★ 플래그 리셋

    stopYouTubeAudio(); // ★ 리셋 시 유튜브 정지
    resetControlsState(); // UI 초기 상태
    resetTimerSettings(); // 시간 설정 읽기
    updateTimerDisplay();
    updateVisualProgress();
    notificationArea.textContent = "";
    timerStatus.textContent = "대기 중";
    hideModal(); // 모달 열려있으면 닫기
  }

  function resetTimerSettings() {
    /* 시간 설정 읽기 */
    const workMinutes = parseInt(workDurationInput.value);
    const breakMinutes = parseInt(breakDurationInput.value);
    totalDurationSeconds =
      currentTimerMode === "work" ? workMinutes * 60 : breakMinutes * 60;
    if (remainingSeconds <= 0) {
      remainingSeconds = totalDurationSeconds;
    }
  }

  // --- UI 및 컨트롤 상태 관리 ---
  function setControlsState(isRunning) {
    /* UI 모드 전환 및 버튼 활성화 */
    if (isRunning) {
      body.classList.add("timer-running");
    } else {
      body.classList.remove("timer-running");
    }
    startButton.disabled = isRunning;
    pauseButton.disabled = !isRunning && !isPaused;
    resetButton.disabled = false; // 리셋 버튼은 거의 항상 활성화
    const settingElements = document.querySelectorAll(
      ".settings-area input, .settings-area select, .settings-area button"
    ); // 버튼 포함
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
    /* 컨트롤 UI 초기화 */
    setControlsState(false);
    pauseButton.textContent = "일시정지";
    pauseButton.classList.remove("resume");
    pauseButton.disabled = true;
  }

  // --- 이벤트 리스너 ---
  imageUpload.addEventListener("change", (event) => {
    /* 이미지 업로드 */
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        userImageSrc = e.target.result;
        backgroundImage.src = userImageSrc;
        backgroundImage.style.display = "block";
        if (
          visualEffectTypeSelect.value === "image" &&
          !timerInterval &&
          !delayInterval &&
          !isPaused
        ) {
          updateVisualProgress();
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("이미지 파일만 선택 가능합니다.");
      imageUpload.value = "";
    }
  });
  visualEffectTypeSelect.addEventListener("change", () => {
    /* 시각 효과 변경 */
    imageUploadContainer.style.display =
      visualEffectTypeSelect.value === "image" ? "flex" : "none";
    if (!timerInterval && !delayInterval && !isPaused) {
      updateVisualProgress();
    }
  });
  [
    workDurationInput,
    breakDurationInput,
    delayInput,
    notifyInput,
    notificationTypeSelect,
  ].forEach((el) => {
    /* 설정 변경 */
    el.addEventListener("change", () => {
      if (!timerInterval && !delayInterval && !isPaused) {
        resetTimer();
      } else {
        console.warn("타이머 실행 중 설정 변경 불가"); /* 값 복원 필요 */
      }
    });
  });
  startButton.addEventListener("click", startTimer);
  pauseButton.addEventListener("click", pauseTimer);
  resetButton.addEventListener("click", resetTimer);

  // --- 초기화 ---
  updateCurrentTime();
  currentTimeInterval = setInterval(updateCurrentTime, 1000);
  imageUploadContainer.style.display =
    visualEffectTypeSelect.value === "image" ? "flex" : "none";
  resetTimer(); // 페이지 로드 시 초기화

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
  document.body.addEventListener("touchstart", initializeAudioContext); // 모바일 터치 고려
}); // End DOMContentLoaded
