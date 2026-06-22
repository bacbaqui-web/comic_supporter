let currentDate = new Date();

export function initCalendar() {
  // 시간/날짜 관련 유틸리티
  const TZ = 'Asia/Seoul';
  function ymdKST(date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }
  function toKST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: TZ }));
  }
  function countWeekdaysBetweenKST(a, b) {
    let c = 0,
      start = toKST(new Date(Math.min(a, b))),
      end = toKST(new Date(Math.max(a, b))),
      cur = new Date(start);
    while (cur <= end) {
      const d = cur.getDay();
      if (d >= 1 && d <= 5) c++;
      cur.setDate(cur.getDate() + 1);
    }
    return c;
  }
  // ===== Episode calculator: episodes increase on weekdays (Mon~Fri) =====
  // 기준: 2026-02-02(월) = 2123화 (주말은 회차 진행 없음)
  function isEpisodeDay(dateObj) {
    const dow = dateObj.getDay(); // 0=Sun ... 6=Sat
    return dow >= 1 && dow <= 5; // Mon~Fri
  }

  function countEpisodeDaysExclusiveStartInclusiveEnd(startDateObj, endDateObj) {
    // counts eligible days in (start, end] assuming start < end
    let count = 0;
    const cur = new Date(
      startDateObj.getFullYear(),
      startDateObj.getMonth(),
      startDateObj.getDate()
    );
    const end = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
    cur.setDate(cur.getDate() + 1);
    while (cur <= end) {
      if (isEpisodeDay(cur)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function episodeNumberForDate(targetDateObj) {
    const baseDate = new Date(2026, 1, 2); // 2026-02-02 (Mon)
    const baseEpisode = 2123;

    const t = new Date(
      targetDateObj.getFullYear(),
      targetDateObj.getMonth(),
      targetDateObj.getDate()
    );

    if (t.getTime() === baseDate.getTime()) return baseEpisode;

    if (t > baseDate) {
      const n = countEpisodeDaysExclusiveStartInclusiveEnd(baseDate, t);
      return baseEpisode + n;
    } else {
      const n = countEpisodeDaysExclusiveStartInclusiveEnd(t, baseDate);
      return baseEpisode - n;
    }
  }

  // const fixedSchedules=[{title:'쇼츠',daysOfWeek:[1,3,5],colorClass:'recurring-shorts'},{title:'웹툰',daysOfWeek:[2,4,6],colorClass:'recurring-instatoon'}];

  // 모달 관련 DOM
  const taskModal = document.getElementById('taskModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const saveTaskBtn = document.getElementById('saveTaskBtn');
  const deleteTaskBtn = document.getElementById('deleteTaskBtn');
  const taskTitleInput = document.getElementById('taskTitle');
  const taskDescriptionInput = document.getElementById('taskDescription');
  const taskDateInput = document.getElementById('taskDate');
  const taskCategorySelect = document.getElementById('taskCategory');
  const todoOnlyCheckbox = document.getElementById('todoOnly');

  // 달력 아래 리스트
  const agendaListEl = document.getElementById('agendaList');

  const attachCalendarEventListeners = () => {
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    prevMonthBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
    nextMonthBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });

    todoOnlyCheckbox?.addEventListener('change', () => {
      const on = !!todoOnlyCheckbox.checked;
      if (taskDateInput) {
        taskDateInput.disabled = on;
        if (on) taskDateInput.value = '';
      }
    });

    cancelBtn?.addEventListener('click', closeModal);
    saveTaskBtn?.addEventListener('click', saveTask);
    deleteTaskBtn?.addEventListener('click', () => window.deleteTask && window.deleteTask());
    taskModal?.addEventListener('click', (e) => {
      if (e.target === taskModal) closeModal();
    });
  };

  // 달력 렌더링
  const renderCalendar = () => {
    const year = currentDate.getFullYear(),
      month = currentDate.getMonth();
    const currentMonthYear = document.getElementById('currentMonthYear');
    const calendarGrid = document.getElementById('calendarGrid');
    if (!currentMonthYear || !calendarGrid) return;
    calendarGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let shortsCount = 0,
      webtoonCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = ymdKST(new Date(year, month, d));
      if ((window.taskStatus || {})[`${ymd}_daily_shorts`]) shortsCount++;
      if ((window.taskStatus || {})[`${ymd}_daily_webtoon`]) webtoonCount++;
    }
    currentMonthYear.innerHTML = `${year}년 ${month + 1}월 <span class="calendar-month-counts"><span class="calendar-count-badge shorts">숏 ${shortsCount}</span><span class="calendar-count-badge webtoon">툰 ${webtoonCount}</span></span>`;
    // Week starts on Monday (월~일). Convert JS getDay() (Sun=0..Sat=6) to Monday-first index.
    const leadingBlanks = (firstDay + 6) % 7;
    for (let i = 0; i < leadingBlanks; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day';
      calendarGrid.appendChild(empty);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('calendar-day', 'relative');
      const thisDate = new Date(year, month, day);
      const fullDate = ymdKST(thisDate);
      const dayOfWeek = thisDate.getDay();
      const today = new Date();
      if (ymdKST(thisDate) === ymdKST(today)) dayDiv.classList.add('today');
      const dayTop = document.createElement('div');
      dayTop.className = 'day-top';
      const dayNumberSpan = document.createElement('span');
      dayNumberSpan.classList.add('day-number');
      dayNumberSpan.textContent = day;
      dayTop.appendChild(dayNumberSpan);

      // 1) 매일 쇼츠/웹툰 체크 버튼 그룹 (날짜 옆에 작게 표시)
      const checkGroup = document.createElement('div');
      checkGroup.className = 'daily-check-group';

      // 쇼츠 버튼
      const shortsBtn = document.createElement('div');
      shortsBtn.className = 'daily-check-btn shorts';
      shortsBtn.textContent = '숏';
      const shortsKey = `${fullDate}_daily_shorts`;
      if ((window.taskStatus || {})[shortsKey]) shortsBtn.classList.add('active');
      shortsBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!window.ensureLogin || !window.ensureLogin()) return;
        window.taskStatus = window.taskStatus || {};
        window.taskStatus[shortsKey] = !window.taskStatus[shortsKey];
        await window.cloudSaveStateOnly();
        renderCalendar();
      });

      // 웹툰 버튼
      const webtoonBtn = document.createElement('div');
      webtoonBtn.className = 'daily-check-btn webtoon';
      webtoonBtn.textContent = '툰';
      const webtoonKey = `${fullDate}_daily_webtoon`;
      if ((window.taskStatus || {})[webtoonKey]) webtoonBtn.classList.add('active');
      webtoonBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!window.ensureLogin || !window.ensureLogin()) return;
        window.taskStatus = window.taskStatus || {};
        window.taskStatus[webtoonKey] = !window.taskStatus[webtoonKey];
        await window.cloudSaveStateOnly();
        renderCalendar();
      });

      checkGroup.appendChild(shortsBtn);
      checkGroup.appendChild(webtoonBtn);
      dayTop.appendChild(checkGroup);
      dayDiv.appendChild(dayTop);

      // 날짜/체크 버튼 아래 구분선
      const divider = document.createElement('div');
      divider.className = 'day-divider';
      dayDiv.appendChild(divider);

      // 2) 에피소드 정보 (월~금만 표시) - 날짜/체크 버튼 아래
      //    주말(토/일)은 회차 진행이 없으므로 표시하지 않음.
      if (isEpisodeDay(thisDate)) {
        const episodeNumber = episodeNumberForDate(thisDate);
        const epItem = document.createElement('div');
        epItem.classList.add('task-item', 'episode-task');
        epItem.textContent = `${episodeNumber}화`;
        const key = `${fullDate}_바퀴멘터리 ${episodeNumber}화`;
        if ((window.taskStatus || {})[key]) epItem.classList.add('complete');
        epItem.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!window.ensureLogin || !window.ensureLogin()) return;
          window.taskStatus = window.taskStatus || {};
          window.taskStatus[key] = !window.taskStatus[key];
          await window.cloudSaveStateOnly();
          renderCalendar();
        });
        dayDiv.appendChild(epItem);
      }

      // 3) 사용자 커스텀 태스크 (개인작업) - 에피소드 아래
      (window.customTasks || [])
        .filter((t) => t.date === fullDate)
        .forEach((task) => {
          const el = document.createElement('div');
          el.classList.add('task-item', 'custom-task');
          if (task.category === 'important') el.classList.add('custom-important');
          if (task.category === 'family') el.classList.add('custom-family');
          if (task.category === 'special') el.classList.add('custom-special');
          el.textContent = task.title;
          if (task.complete) el.classList.add('complete');
          el.addEventListener('click', async (e) => {
            if (e.detail === 1) {
              if (!window.ensureLogin || !window.ensureLogin()) return;
              task.complete = !task.complete;
              await window.cloudSaveAll();
              renderCalendar();
            } else if (e.detail === 2) {
              openModal(task);
            }
          });
          dayDiv.appendChild(el);
        });

      dayDiv.addEventListener('click', (e) => {
        if (
          e.target.classList.contains('calendar-day') ||
          e.target.classList.contains('day-number')
        )
          openModal({ date: fullDate });
      });
      calendarGrid.appendChild(dayDiv);
    }

    // 달력 아래 리스트도 함께 갱신
    renderAgendaList();
  };

  // 달력 아래 리스트 (문구/추가버튼/체크박스 제거)
  const renderAgendaList = () => {
    if (!agendaListEl) return;
    const tasks = (window.customTasks || []).slice();
    const order = { important: 1, family: 2, special: 3 };
    const dotColor = (cat) => {
      if (cat === 'important') return '#dc2626';
      if (cat === 'family') return '#2563eb';
      if (cat === 'special') return '#16a34a';
      return '#9ca3af';
    };

    // D-day 계산 (KST 자정 기준)
    const toKSTMidnight = (d) => {
      const k = toKST(d);
      return new Date(k.getFullYear(), k.getMonth(), k.getDate());
    };
    const parseYMD = (s) => {
      const [y, m, dd] = String(s).split('-').map(Number);
      return new Date(y, (m || 1) - 1, dd || 1);
    };
    const diffDaysFromToday = (ymd) => {
      const today = toKSTMidnight(new Date());
      const target = toKSTMidnight(parseYMD(ymd));
      return Math.round((target - today) / (1000 * 60 * 60 * 24));
    };
    const formatDday = (ymd) => {
      const diff = diffDaysFromToday(ymd);
      if (diff === 0) return 'D-day';
      if (diff > 0) return `D-${diff}`;
      return null; // 지난 일정은 표시하지 않음
    };

    const dated = tasks
      .filter(
        (t) =>
          !!t.date && ['important', 'family', 'special'].includes(t.category) && formatDday(t.date)
      )
      .sort((a, b) => {
        const ca = !!a.complete,
          cb = !!b.complete;
        if (ca !== cb) return ca ? 1 : -1; // 완료는 아래로
        const da = String(a.date);
        const db = String(b.date);
        if (da !== db) return da.localeCompare(db);
        return (order[a.category] || 99) - (order[b.category] || 99);
      });

    const undated = tasks
      .filter((t) => !t.date || String(t.date).trim() === '')
      .sort((a, b) => {
        // 미완료 우선, 그 다음 최신순
        const ca = !!a.complete,
          cb = !!b.complete;
        if (ca !== cb) return ca ? 1 : -1;
        return Number(b.id || 0) - Number(a.id || 0);
      });

    const makeRow = (t, { showDate }) => {
      const row = document.createElement('div');
      row.className = 'agenda-item';

      const dot = document.createElement('div');
      dot.className = 'agenda-dot';
      dot.style.background = dotColor(t.category);

      const date = document.createElement('div');
      date.className = 'agenda-date';
      date.textContent = showDate ? formatDday(t.date) || '' : '';

      const text = document.createElement('div');
      text.className = 'agenda-text';
      text.textContent = t.title;
      if (t.complete) {
        row.classList.add('complete');
        // 완료 표시(원래처럼): 회색 + 취소선
        text.style.textDecoration = 'line-through';
        text.style.opacity = '.9';
        text.style.color = '#7a7a7a';
      }

      const actions = document.createElement('div');
      actions.className = 'agenda-actions';

      // 설정(편집) 버튼만 유지
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'agenda-settings-btn';
      settingsBtn.type = 'button';
      settingsBtn.setAttribute('title', '설정');
      settingsBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:18px;height:18px;opacity:.9">
            <path d="M12 20a1 1 0 0 1-1-1v-1.1a7.8 7.8 0 0 1-1.9-.8l-.8.8a1 1 0 0 1-1.4 0l-1.4-1.4a1 1 0 0 1 0-1.4l.8-.8a7.8 7.8 0 0 1-.8-1.9H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h1.1a7.8 7.8 0 0 1 .8-1.9l-.8-.8a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0l.8.8a7.8 7.8 0 0 1 1.9-.8V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.1a7.8 7.8 0 0 1 1.9.8l.8-.8a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 0 1 0 1.4l-.8.8a7.8 7.8 0 0 1 .8 1.9H20a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.1a7.8 7.8 0 0 1-.8 1.9l.8.8a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0l-.8-.8a7.8 7.8 0 0 1-1.9.8V19a1 1 0 0 1-1 1z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>`;
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(t);
      });
      actions.appendChild(settingsBtn);

      row.appendChild(dot);
      row.appendChild(date);
      row.appendChild(text);
      row.appendChild(actions);

      // 항목 클릭: 완료 토글(체크박스 대신)
      row.addEventListener('click', async () => {
        if (!window.ensureLogin || !window.ensureLogin()) return;
        t.complete = !t.complete;

        // 즉시 UI 반영: 회색 + 취소선 (원래처럼)
        row.classList.toggle('complete', !!t.complete);
        if (t.complete) {
          text.style.textDecoration = 'line-through';
          text.style.opacity = '.9';
          text.style.color = '#7a7a7a';
        } else {
          text.style.textDecoration = '';
          text.style.opacity = '';
          text.style.color = '';
        }

        // 완료 항목은 아래로 이동
        if (row.parentElement) {
          const parent = row.parentElement;
          if (t.complete) parent.appendChild(row);
          else parent.prepend(row);
        }

        await window.cloudSaveAll();
        renderCalendar();
      });
      return row;
    };

    agendaListEl.innerHTML = '';

    // 1) 날짜 없는 항목을 위로
    undated.forEach((t) => agendaListEl.appendChild(makeRow(t, { showDate: false })));
    // 2) 날짜 있는 일정은 아래로
    dated.forEach((t) => agendaListEl.appendChild(makeRow(t, { showDate: true })));
  };

  // 작업 모달
  const openModal = (task = null) => {
    window.currentTask = task;
    if (task && task.id) {
      document.getElementById('modalTitle').textContent = '작업 수정';
      taskTitleInput.value = task.title;
      taskDescriptionInput.value = task.description || '';
      taskDateInput.value = task.date || '';
      if (taskCategorySelect) taskCategorySelect.value = task.category || '';
      if (todoOnlyCheckbox) todoOnlyCheckbox.checked = !!task.todoOnly || !task.date;
      if (taskDateInput) taskDateInput.disabled = !!(todoOnlyCheckbox && todoOnlyCheckbox.checked);
      deleteTaskBtn.classList.remove('hidden');
    } else if (task && 'date' in task) {
      document.getElementById('modalTitle').textContent = '새 작업';
      taskTitleInput.value = '';
      taskDescriptionInput.value = '';
      taskDateInput.value = task.date || '';
      if (taskCategorySelect) taskCategorySelect.value = task.category || '';
      if (todoOnlyCheckbox) todoOnlyCheckbox.checked = !!task.todoOnly || !task.date;
      if (taskDateInput) taskDateInput.disabled = !!(todoOnlyCheckbox && todoOnlyCheckbox.checked);
      deleteTaskBtn.classList.add('hidden');
    } else {
      document.getElementById('modalTitle').textContent = '새 작업';
      taskTitleInput.value = '';
      taskDescriptionInput.value = '';
      taskDateInput.value = '';
      if (taskCategorySelect) taskCategorySelect.value = '';
      if (todoOnlyCheckbox) todoOnlyCheckbox.checked = false;
      if (taskDateInput) taskDateInput.disabled = false;
      deleteTaskBtn.classList.add('hidden');
    }
    taskModal.style.display = 'flex';
  };
  const closeModal = () => {
    taskModal.style.display = 'none';
  };

  const saveTask = async () => {
    if (!window.ensureLogin || !window.ensureLogin()) return;
    window.customTasks = window.customTasks || [];
    window.taskStatus = window.taskStatus || {};
    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();
    const date = taskDateInput.value;
    const category = taskCategorySelect ? taskCategorySelect.value || '' : '';
    const todoOnly = !!(todoOnlyCheckbox && todoOnlyCheckbox.checked);
    if (!title) {
      window.showFeedbackMessage?.('제목을 입력해주세요.');
      return;
    }
    const finalDate = todoOnly ? '' : date;
    const data = {
      id: window.currentTask && window.currentTask.id ? window.currentTask.id : Date.now(),
      title,
      description,
      date: finalDate,
      category,
      todoOnly,
      complete: window.currentTask?.complete ?? false
    };
    const idx = window.customTasks.findIndex((t) => t.id === data.id);
    if (idx > -1) window.customTasks[idx] = data;
    else window.customTasks.push(data);
    await window.cloudSaveAll();
    closeModal();
    renderCalendar();
  };

  attachCalendarEventListeners();
  window.renderCalendar = renderCalendar;
  window.openTaskModal = openModal;
  window.closeTaskModal = closeModal;
  renderCalendar();
}
