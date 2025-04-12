document.addEventListener("DOMContentLoaded", () => {
  // --- DOM 요소 참조 ---
  const currentTimeDisplay = document.getElementById("currentTimeDisplay");
  const timerDisplay = document.getElementById("timerDisplay");
  const timerStatus = document.getElementById("timerStatus");
  const notificationArea = document.getElementById("notificationArea");
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const resetButton = document.getElementById("resetButton");
  const typeSingleRadio = document.getElementById("typeSingle");
  const typePomodoroRadio = document.getElementById("typePomodoro");
  const workDurationInput = document.getElementById("workDurationInput");
  const breakSettingsDiv = document.getElementById("breakSettings");
  const breakDurationInput = document.getElementById("breakDurationInput");
  const delayInput = document.getElementById("delayInput");
  const notifyInput = document.getElementById("notifyInput");
  const notificationTypeSelect = document.getElementById("notificationType");
  const visualEffectTypeSelect = document.getElementById("visualEffectType");
  const fadeOverlay = document.getElementById("fadeOverlay");
  const imageEffectContainer = document.getElementById("imageEffectContainer");
  const backgroundImage = document.getElementById("backgroundImage");
  const imageOverlay = document.getElementById("imageOverlay");
  // const beepSound = document.getElementById('beepSound'); // <audio> 요소 제거

  // --- 상태 변수 ---
  let timerInterval = null;
  let delayTimeout = null;
  let currentTimeInterval = null;
  let totalDurationSeconds = 0;
  let remainingSeconds = 0;
  let currentTimerMode = "work";
  let pomodoroCycleCount = 0;
  let isPaused = false;
  let notificationShown = false;
  let audioContext = null; // AudioContext 참조 변수 추가

  // --- 현재 시각 업데이트 ---
  function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }

  // --- 타이머 디스플레이 업데이트 ---
  function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  // --- 시각적 진행률 업데이트 ---
  function updateVisualProgress() {
    const elapsedSeconds = totalDurationSeconds - remainingSeconds;
    let progressPercentage =
      totalDurationSeconds > 0
        ? (elapsedSeconds / totalDurationSeconds) * 100
        : 0;
    if (progressPercentage > 100) progressPercentage = 100;

    let useEffect = visualEffectTypeSelect.value;
    const isImageAvailable =
      backgroundImage.complete && backgroundImage.naturalWidth !== 0;

    if (useEffect === "image" && !isImageAvailable) {
      useEffect = "fade";
    }

    fadeOverlay.style.display = useEffect === "fade" ? "block" : "none";
    imageEffectContainer.style.display =
      useEffect === "image" ? "block" : "none";

    if (useEffect === "fade") {
      fadeOverlay.style.height = `${100 - progressPercentage}%`;
    } else {
      imageOverlay.style.height = `${100 - progressPercentage}%`;
    }
  }

  // --- ★ 삐 소리 재생 함수 (Web Audio API 사용) ---
  function playBeepFallback() {
    try {
      // AudioContext 초기화 (최초 한번 또는 필요시)
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 사용자의 상호작용 후 컨텍스트가 suspended 상태일 수 있으므로 재개 시도
      if (audioContext.state === "suspended") {
        audioContext
          .resume()
          .catch((e) => console.error("AudioContext resume error:", e));
      }

      // AudioContext 준비 후 소리 재생 로직 실행
      if (audioContext.state === "running") {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // 볼륨 약간 줄임

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else {
        console.warn("AudioContext is not running, cannot play beep.");
      }
    } catch (e) {
      console.error("Web Audio API 실행 오류:", e);
    }
  }

  // --- ★ 알림 트리거 (playBeepFallback 호출) ---
  function triggerNotification(message, isFinal = false) {
    const type = notificationTypeSelect.value;

    showNotificationOnScreen(message);

    if (type === "speech") {
      if (
        "speechSynthesis" in window &&
        typeof SpeechSynthesisUtterance !== "undefined"
      ) {
        try {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = "ko-KR";
          utterance.onerror = (event) => {
            console.error("음성 합성 오류:", event.error);
            playBeepFallback(); // ★ 음성 실패 시 Web Audio API 사용
          };
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error("음성 합성 시작 오류:", error);
          playBeepFallback(); // ★ 음성 실패 시 Web Audio API 사용
        }
      } else {
        console.warn(
          "브라우저가 음성 합성을 지원하지 않습니다. 삐 소리로 대체합니다."
        );
        playBeepFallback(); // ★ 음성 미지원 시 Web Audio API 사용
      }
    } else if (type === "beep") {
      playBeepFallback(); // ★ '삐 소리' 선택 시 Web Audio API 사용
    }

    notificationShown = !isFinal;
  }

  // --- 화면 텍스트 알림 표시 ---
  function showNotificationOnScreen(message) {
    notificationArea.textContent = message;
  }

  // --- 타이머 로직 (startTimer, runInterval, handleTimerEnd) ---
  function startTimer() {
    if (timerInterval || delayTimeout) return;
    isPaused = false;
    setControlsState(true);
    const isPomodoro = typePomodoroRadio.checked;
    const workMinutes = parseInt(workDurationInput.value);
    const breakMinutes = parseInt(breakDurationInput.value);
    const delaySeconds = parseInt(delayInput.value);
    const notifyMinutesBeforeEnd = parseInt(notifyInput.value);

    if (remainingSeconds <= 0) {
      if (isPomodoro) {
        if (currentTimerMode === "work") {
          totalDurationSeconds = workMinutes * 60;
          timerStatus.textContent = `집중 시간 (${pomodoroCycleCount + 1}번째)`;
        } else {
          totalDurationSeconds = breakMinutes * 60;
          timerStatus.textContent = "휴식 시간";
        }
      } else {
        totalDurationSeconds = workMinutes * 60;
        currentTimerMode = "work";
        timerStatus.textContent = "타이머 작동 중";
      }
      remainingSeconds = totalDurationSeconds;
      notificationShown = false;
    }
    const notifySecondsBeforeEnd = notifyMinutesBeforeEnd * 60;

    if (delaySeconds > 0 && !isPaused) {
      showNotificationOnScreen(`${delaySeconds}초 후 시작합니다...`);
      delayTimeout = setTimeout(() => {
        delayTimeout = null;
        if (!isPaused) {
          notificationArea.textContent = "";
          runInterval(notifySecondsBeforeEnd);
        }
      }, delaySeconds * 1000);
    } else {
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
        );
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
    const isPomodoro = typePomodoroRadio.checked;
    let finalMessage = "시간 종료!";

    if (isPomodoro) {
      if (currentTimerMode === "work") {
        finalMessage = "집중 시간 종료! 휴식을 시작하세요.";
        currentTimerMode = "break";
        pomodoroCycleCount++;
        triggerNotification(finalMessage, true);
        resetTimerInternalState(false);
        startTimer();
      } else {
        finalMessage = "휴식 시간 종료! 집중을 시작하세요.";
        currentTimerMode = "work";
        triggerNotification(finalMessage, true);
        resetTimerInternalState(false);
        startTimer();
      }
    } else {
      triggerNotification(finalMessage, true);
      timerStatus.textContent = "완료";
      resetControlsState();
    }
  }

  // --- 일시정지, 리셋, 컨트롤 상태 관리 함수 ---
  function pauseTimer() {
    if (delayTimeout) {
      clearTimeout(delayTimeout);
      delayTimeout = null;
      isPaused = true;
      showNotificationOnScreen("시작 지연 중지됨. '재개'를 누르세요.");
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
      startButton.disabled = true;
      pauseButton.disabled = false;
      resetButton.disabled = false;
    } else if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      isPaused = true;
      timerStatus.textContent += " (일시정지됨)";
      pauseButton.textContent = "재개";
      pauseButton.classList.add("resume");
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
    clearTimeout(delayTimeout);
    timerInterval = null;
    delayTimeout = null;
    resetTimerInternalState(true);
    resetControlsState();
    updateTimerDisplay();
    updateVisualProgress();
    notificationArea.textContent = "";
    timerStatus.textContent = "대기 중";
  }

  function resetTimerInternalState(resetModeAndCycle = true) {
    isPaused = false;
    notificationShown = false;
    remainingSeconds = 0;
    totalDurationSeconds = 0;
    if (resetModeAndCycle) {
      currentTimerMode = "work";
      pomodoroCycleCount = 0;
    }
  }

  function setControlsState(isRunning) {
    startButton.disabled = isRunning;
    pauseButton.disabled = !isRunning || delayTimeout !== null;
    resetButton.disabled = !isRunning && !isPaused && delayTimeout === null;
    const settingElements = document.querySelectorAll(
      ".settings-area input, .settings-area select"
    );
    settingElements.forEach(
      (el) => (el.disabled = isRunning || isPaused || delayTimeout !== null)
    );
    if (isRunning && !isPaused && delayTimeout === null) {
      pauseButton.textContent = "일시정지";
      pauseButton.classList.remove("resume");
    }
    if (!isRunning && !isPaused && delayTimeout === null) {
      pauseButton.textContent = "일시정지";
      pauseButton.classList.remove("resume");
      pauseButton.disabled = true;
    }
  }

  function resetControlsState() {
    setControlsState(false);
    resetButton.disabled = false;
  }

  // --- 이벤트 리스너 ---
  startButton.addEventListener("click", startTimer);
  pauseButton.addEventListener("click", pauseTimer);
  resetButton.addEventListener("click", resetTimer);
  [
    workDurationInput,
    breakDurationInput,
    delayInput,
    notifyInput,
    notificationTypeSelect,
    visualEffectTypeSelect,
    typeSingleRadio,
    typePomodoroRadio,
  ].forEach((el) => {
    el.addEventListener("change", () => {
      if (el === typeSingleRadio || el === typePomodoroRadio) {
        breakSettingsDiv.style.display = typePomodoroRadio.checked
          ? "flex"
          : "none";
      }
      if (
        el === visualEffectTypeSelect &&
        !timerInterval &&
        !delayTimeout &&
        !isPaused
      ) {
        updateVisualProgress();
      } else {
        resetTimer();
      }
    });
  });

  // --- 초기화 ---
  updateCurrentTime();
  currentTimeInterval = setInterval(updateCurrentTime, 1000);
  resetTimer();
  breakSettingsDiv.style.display = typePomodoroRadio.checked ? "flex" : "none";

  // --- ★ AudioContext 초기화 및 재개를 위한 사용자 상호작용 리스너 ---
  // 페이지의 아무 곳이나 처음 클릭하면 AudioContext를 초기화하거나 재개합니다.
  function initializeAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext initialized.");
      } catch (e) {
        console.error("Failed to initialize AudioContext:", e);
      }
    }
    // 이미 생성되었지만 suspended 상태라면 resume 시도
    if (audioContext && audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(() => {
          console.log("AudioContext resumed successfully.");
        })
        .catch((e) => console.error("AudioContext resume error:", e));
    }
    // 이벤트 리스너 제거 (한 번만 실행)
    document.body.removeEventListener("click", initializeAudioContext);
    document.body.removeEventListener("touchstart", initializeAudioContext);
  }
  document.body.addEventListener("click", initializeAudioContext);
  document.body.addEventListener("touchstart", initializeAudioContext); // 모바일 터치 고려
});
