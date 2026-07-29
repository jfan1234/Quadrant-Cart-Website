const calendarState = {
    activeMonth: startOfMonth(new Date()),
    eventsByDate: new Map()
};

const calendarElements = {
    grid: document.querySelector("[data-calendar-grid]"),
    month: document.querySelector("[data-calendar-month]"),
    year: document.querySelector("[data-calendar-year]"),
    previous: document.querySelector("[data-calendar-prev]"),
    next: document.querySelector("[data-calendar-next]"),
    selectedEvents: document.querySelector("[data-selected-events]"),
    publicEvents: document.querySelector("[data-public-events]")
};

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
});

let cachedEventsPromise;

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLocalDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function isValidEvent(event) {
    return event
        && typeof event.title === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
        && typeof event.public === "boolean";
}

function getPublicTitle(event) {
    return event.public ? event.title : "Private Event";
}

function sortEvents(events) {
    return [...events].sort((first, second) => {
        const dateOrder = first.date.localeCompare(second.date);
        return dateOrder || (first.time || "").localeCompare(second.time || "");
    });
}

function groupEventsByDate(events) {
    return events.reduce((groupedEvents, event) => {
        if (!groupedEvents.has(event.date)) {
            groupedEvents.set(event.date, []);
        }

        groupedEvents.get(event.date).push(event);
        return groupedEvents;
    }, new Map());
}

async function fetchEvents() {
    if (!cachedEventsPromise) {
        cachedEventsPromise = fetch("events.json", { cache: "no-cache" })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Unable to load events.");
                }

                return response.json();
            })
            .then((events) => {
                if (!Array.isArray(events)) {
                    return [];
                }

                return sortEvents(events.filter(isValidEvent));
            });
    }

    return cachedEventsPromise;
}

function createPrivateEventCard() {
    const card = document.createElement("article");
    card.className = "event-card event-card-private";

    const title = document.createElement("h3");
    title.textContent = "Private Event";

    card.append(title);
    return card;
}

function createEventCard(event) {
    if (!event.public) {
        return createPrivateEventCard();
    }

    const card = document.createElement("article");
    card.className = "event-card";

    const eventDate = parseLocalDate(event.date);
    const time = document.createElement("time");
    time.dateTime = event.date;
    time.textContent = dateFormatter.format(eventDate);

    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = event.title;

    const details = document.createElement("p");
    const visibleDetails = [event.time, event.location].filter(Boolean).join(" · ");
    details.textContent = visibleDetails;

    content.append(title);

    if (visibleDetails) {
        content.append(details);
    }

    card.append(time, content);
    return card;
}

function renderPublicEvents(events) {
    calendarElements.publicEvents.replaceChildren();

    const todayKey = getDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const publicEvents = events.filter((event) => event.public && event.date >= todayKey);

    if (!publicEvents.length) {
        calendarElements.publicEvents.append(createEmptyMessage("No upcoming public events."));
        return;
    }

    const eventFragment = document.createDocumentFragment();
    publicEvents.forEach((event) => eventFragment.append(createEventCard(event)));
    calendarElements.publicEvents.append(eventFragment);
}

function createEmptyMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.className = "event-empty";
    paragraph.textContent = message;
    return paragraph;
}

function renderSelectedEvents(dateKey) {
    const events = calendarState.eventsByDate.get(dateKey) || [];
    calendarElements.selectedEvents.replaceChildren();
    calendarElements.grid.querySelectorAll(".calendar-day.is-selected").forEach((day) => {
        day.classList.remove("is-selected");
        day.removeAttribute("aria-current");
    });

    const selectedDay = calendarElements.grid.querySelector(`[data-date="${dateKey}"]`);

    if (selectedDay) {
        selectedDay.classList.add("is-selected");
        selectedDay.setAttribute("aria-current", "date");
    }

    if (!events.length) {
        calendarElements.selectedEvents.append(createEmptyMessage("No events scheduled for this date."));
        return;
    }

    const heading = document.createElement("h3");
    heading.textContent = fullDateFormatter.format(parseLocalDate(dateKey));

    const eventFragment = document.createDocumentFragment();
    events.forEach((event) => eventFragment.append(createEventCard(event)));
    calendarElements.selectedEvents.append(heading, eventFragment);
}

function getEventDayLabel(dateKey, events) {
    const dateLabel = fullDateFormatter.format(parseLocalDate(dateKey));
    const eventLabels = events.map(getPublicTitle).join(", ");
    return `${dateLabel}: ${eventLabels}`;
}

function createCalendarDay(date, isCurrentMonth) {
    const dateKey = getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    const events = calendarState.eventsByDate.get(dateKey) || [];
    const day = document.createElement("button");

    day.type = "button";
    day.className = "calendar-day";
    day.textContent = date.getDate();
    day.dataset.date = dateKey;
    day.setAttribute("aria-label", fullDateFormatter.format(date));

    if (!isCurrentMonth) {
        day.classList.add("is-muted");
        day.tabIndex = -1;
    }

    if (events.length) {
        day.classList.add("has-event");
        day.setAttribute("aria-label", getEventDayLabel(dateKey, events));
    }

    return day;
}

function renderCalendar() {
    const year = calendarState.activeMonth.getFullYear();
    const month = calendarState.activeMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const fragment = document.createDocumentFragment();

    calendarElements.month.textContent = monthFormatter.format(calendarState.activeMonth);
    calendarElements.year.textContent = year;

    for (let index = 0; index < 42; index += 1) {
        let dayDate;
        let isCurrentMonth = true;

        if (index < firstWeekday) {
            const dateNumber = previousMonthDays - firstWeekday + index + 1;
            dayDate = new Date(year, month - 1, dateNumber);
            isCurrentMonth = false;
        } else if (index >= firstWeekday + daysInMonth) {
            const dateNumber = index - firstWeekday - daysInMonth + 1;
            dayDate = new Date(year, month + 1, dateNumber);
            isCurrentMonth = false;
        } else {
            dayDate = new Date(year, month, index - firstWeekday + 1);
        }

        fragment.append(createCalendarDay(dayDate, isCurrentMonth));
    }

    calendarElements.grid.querySelectorAll(".calendar-day").forEach((day) => day.remove());
    calendarElements.grid.append(fragment);
}

function changeMonth(monthOffset) {
    calendarState.activeMonth = new Date(
        calendarState.activeMonth.getFullYear(),
        calendarState.activeMonth.getMonth() + monthOffset,
        1
    );
    renderCalendar();
    calendarElements.selectedEvents.replaceChildren(
        createEmptyMessage("Select a highlighted date to view event details.")
    );
}

function handleCalendarClick(event) {
    const day = event.target.closest(".calendar-day");

    if (!day || !calendarElements.grid.contains(day)) {
        return;
    }

    renderSelectedEvents(day.dataset.date);
}

function moveFocusByDays(currentDay, dayOffset) {
    const currentDate = parseLocalDate(currentDay.dataset.date);
    const targetDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + dayOffset
    );

    calendarState.activeMonth = startOfMonth(targetDate);
    renderCalendar();
    calendarElements.grid.querySelector(`[data-date="${getDateKey(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
    )}"]`)?.focus();
}

function handleCalendarKeydown(event) {
    const currentDay = event.target.closest(".calendar-day");

    if (!currentDay) {
        return;
    }

    const keyActions = {
        ArrowLeft: () => moveFocusByDays(currentDay, -1),
        ArrowRight: () => moveFocusByDays(currentDay, 1),
        ArrowUp: () => moveFocusByDays(currentDay, -7),
        ArrowDown: () => moveFocusByDays(currentDay, 7),
        PageUp: () => changeMonth(-1),
        PageDown: () => changeMonth(1)
    };

    if (!keyActions[event.key]) {
        return;
    }

    event.preventDefault();
    keyActions[event.key]();
}

async function initializeCalendar() {
    if (!calendarElements.grid) {
        return;
    }

    renderCalendar();

    try {
        const events = await fetchEvents();
        calendarState.eventsByDate = groupEventsByDate(events);
        renderCalendar();
        renderPublicEvents(events);
    } catch (error) {
        calendarElements.publicEvents.replaceChildren(createEmptyMessage("No upcoming public events."));
        calendarElements.selectedEvents.replaceChildren(createEmptyMessage("No upcoming public events."));
    }
}

calendarElements.previous?.addEventListener("click", () => changeMonth(-1));
calendarElements.next?.addEventListener("click", () => changeMonth(1));
calendarElements.grid?.addEventListener("click", handleCalendarClick);
calendarElements.grid?.addEventListener("keydown", handleCalendarKeydown);

initializeCalendar();
