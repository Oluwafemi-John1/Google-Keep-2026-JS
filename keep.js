(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
    if (!user) { window.location.href = 'signin.html'; return }

    const $ = id => document.getElementById(id)
    const NK = 'keep_notes_' + user.mail, LK = 'keep_labels_' + user.mail, PK = 'keep_prefs_' + user.mail
    const COLORS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'darkblue', 'purple', 'pink', 'brown', 'gray']
    const COLOR_NAMES = { default: 'Default', darkblue: 'Dark blue' }
    const WEEK = 7 * 24 * 3600 * 1000
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const icon = n => `<span class="material-icons-outlined">${n}</span>`

    let notes = JSON.parse(localStorage.getItem(NK) || '[]')
    let labels = JSON.parse(localStorage.getItem(LK) || '[]')
    let prefs = Object.assign({ view: 'grid', dark: false, mini: false }, JSON.parse(localStorage.getItem(PK) || '{}'))
    let view = { type: 'notes', label: null }
    let query = ''
    let editingId = null
    let dragId = null

    const saveNotes = () => localStorage.setItem(NK, JSON.stringify(notes))
    const saveLabels = () => localStorage.setItem(LK, JSON.stringify(labels))
    const savePrefs = () => localStorage.setItem(PK, JSON.stringify(prefs))

    // purge old trash
    notes = notes.filter(n => !(n.trashed && Date.now() - n.trashedAt > WEEK))
    saveNotes()

    // ---------- helpers ----------
    const isEmpty = n => !n.title.trim() && !n.body.trim() && !(n.items && n.items.some(i => i.text.trim()))
    const byOrder = (a, b) => b.order - a.order
    let orderCounter = notes.reduce((m, n) => Math.max(m, n.order || 0), 0)
    const nextOrder = () => ++orderCounter
    const getNote = id => notes.find(n => n.id === id)

    const matches = n => {
        if (!query) return true
        const q = query.toLowerCase()
        const hay = [n.title, n.body, ...(n.items || []).map(i => i.text), ...n.labels, n.color !== 'default' ? (COLOR_NAMES[n.color] || n.color) : ''].join('\n').toLowerCase()
        return hay.includes(q)
    }

    const visible = () => notes.filter(n => {
        if (view.type === 'trash') return n.trashed
        if (n.trashed) return false
        if (view.type === 'archive') return n.archived
        if (view.type === 'label') return !n.archived && n.labels.includes(view.label)
        if (query) return true
        return !n.archived
    }).filter(matches)

    // ---------- sidebar ----------
    const NAV = [
        ['notes', 'lightbulb', 'Notes'],
        ['reminders', 'notifications', 'Reminders'],
    ]
    function renderNav() {
        let h = NAV.map(([t, i, l]) => `<li data-type="${t}" class="${view.type === t ? 'active' : ''}">${icon(i)}<span>${l}</span></li>`).join('')
        h += labels.map(l => `<li data-type="label" data-label="${esc(l)}" class="${view.type === 'label' && view.label === l ? 'active' : ''}">${icon('label')}<span>${esc(l)}</span></li>`).join('')
        h += `<li data-type="editlabels">${icon('edit')}<span>Edit labels</span></li>`
        h += `<li data-type="archive" class="${view.type === 'archive' ? 'active' : ''}">${icon('archive')}<span>Archive</span></li>`
        h += `<li data-type="trash" class="${view.type === 'trash' ? 'active' : ''}">${icon('delete')}<span>Trash</span></li>`
        $('navList').innerHTML = h
    }
    $('navList').addEventListener('click', e => {
        const li = e.target.closest('li'); if (!li) return
        const t = li.dataset.type
        if (t === 'editlabels') return openLabelEditor(li)
        if (t === 'reminders') return snack('Reminders are not supported in this clone')
        view = { type: t, label: li.dataset.label || null }
        document.body.classList.remove('navopen')
        render()
    })

    // ---------- rendering ----------
    function itemsHtml(n, limit) {
        const open = n.items.filter(i => !i.done), done = n.items.filter(i => i.done)
        const row = i => `<div class="item ${i.done ? 'done' : ''}"><input type="checkbox" ${i.done ? 'checked' : ''} data-item="${i.id}" ${n.trashed ? 'disabled' : ''}><div class="txt">${esc(i.text)}</div></div>`
        let h = '', count = 0
        for (const i of open) { if (limit && count >= limit) break; h += row(i); count++ }
        const hidden = open.length - count
        if (hidden > 0) h += `<div class="more-items">+ ${hidden} more item${hidden > 1 ? 's' : ''}</div>`
        if (done.length) {
            h += `<div class="done-head">${done.length} completed item${done.length > 1 ? 's' : ''}</div>`
            let dc = 0
            for (const i of done) { if (limit && dc >= 3) break; h += row(i); dc++ }
        }
        return h
    }

    function tools(n) {
        if (n.trashed) return `<button class="icon-btn" data-act="deleteForever" title="Delete forever">${icon('delete_forever')}</button><button class="icon-btn" data-act="restore" title="Restore">${icon('restore_from_trash')}</button>`
        return `<button class="icon-btn" data-act="color" title="Background options">${icon('palette')}</button>
            <button class="icon-btn" data-act="archive" title="${n.archived ? 'Unarchive' : 'Archive'}">${icon(n.archived ? 'unarchive' : 'archive')}</button>
            <button class="icon-btn" data-act="more" title="More">${icon('more_vert')}</button>`
    }
    const chips = (n, removable) => n.labels.map(l => `<span class="chip">${esc(l)}${removable ? `<span class="material-icons-outlined" data-rmlabel="${esc(l)}">close</span>` : ''}</span>`).join('')

    function noteHtml(n, full) {
        const body = n.items ? itemsHtml(n, full ? 0 : 8) : `<div class="n-body" ${full ? 'id="mBody" contenteditable="true"' : ''}>${esc(n.body)}</div>`
        return `${n.trashed ? '' : `<button class="icon-btn pin ${n.pinned ? 'on' : ''}" data-act="pin" title="${n.pinned ? 'Unpin note' : 'Pin note'}">${icon(n.pinned ? 'push_pin' : 'push_pin')}</button>`}
            <div class="n-title" ${full ? 'id="mTitle" contenteditable="true"' : ''}>${esc(n.title)}</div>
            ${body}
            ${n.labels.length ? `<div class="chips">${chips(n, full)}</div>` : ''}`
    }

    function noteEl(n) {
        const d = document.createElement('div')
        d.className = 'note'
        d.dataset.id = n.id
        d.style.background = `var(--c-${n.color})`
        d.draggable = !n.trashed && !query
        d.innerHTML = noteHtml(n, false) + `<div class="toolbar"><div class="tools">${tools(n)}</div></div>`
        return d
    }

    function render() {
        renderNav()
        const area = $('notesArea')
        area.innerHTML = ''
        $('composerWrap').hidden = view.type === 'archive' || view.type === 'trash' || !!query
        $('trashBanner').hidden = view.type !== 'trash' || !notes.some(n => n.trashed)
        const list = visible().sort(byOrder)
        const pinned = view.type === 'notes' || view.type === 'label' ? list.filter(n => n.pinned) : []
        const rest = list.filter(n => !pinned.includes(n))
        const mk = (label, arr) => {
            if (!arr.length) return
            if (label) area.insertAdjacentHTML('beforeend', `<div class="sec-label">${label}</div>`)
            const g = document.createElement('div')
            g.className = 'grid' + (prefs.view === 'list' ? ' list' : '')
            arr.forEach(n => g.appendChild(noteEl(n)))
            area.appendChild(g)
        }
        mk(pinned.length && rest.length ? 'Pinned' : '', pinned)
        mk(pinned.length && rest.length ? 'Others' : '', rest)
        const empty = $('emptyState')
        empty.hidden = list.length > 0
        if (!list.length) {
            const m = query ? ['search', 'No matching results.'] : {
                notes: ['lightbulb', 'Notes you add appear here'],
                archive: ['archive', 'Your archived notes appear here'],
                trash: ['delete', 'No notes in Trash'],
                label: ['label', 'No notes with this label yet'],
                reminders: ['notifications', 'Notes with upcoming reminders appear here'],
            }[view.type]
            empty.innerHTML = icon(m[0]) + m[1]
        }
        layout()
    }

    function layout() {
        document.querySelectorAll('.grid').forEach(g => {
            const notesEls = [...g.children]
            if (g.classList.contains('list')) {
                let y = 0
                notesEls.forEach(el => { el.style.position = 'absolute'; el.style.left = '0'; el.style.top = y + 'px'; y += el.offsetHeight + 16 })
                g.style.height = y + 'px'
                return
            }
            const gap = 16, w = notesEls[0] ? notesEls[0].offsetWidth : 240
            const cols = Math.max(1, Math.floor((g.clientWidth + gap) / (w + gap)))
            const total = cols * w + (cols - 1) * gap
            const off = Math.max(0, (g.clientWidth - total) / 2)
            const heights = new Array(cols).fill(0)
            notesEls.forEach(el => {
                const c = heights.indexOf(Math.min(...heights))
                el.style.left = off + c * (w + gap) + 'px'
                el.style.top = heights[c] + 'px'
                heights[c] += el.offsetHeight + gap
            })
            g.style.height = Math.max(...heights) + 'px'
        })
    }
    window.addEventListener('resize', layout)

    // ---------- note actions ----------
    let undoFn = null, snackTimer
    function snack(msg, undo) {
        $('snackMsg').textContent = msg
        undoFn = undo || null
        $('snackUndo').hidden = !undo
        $('snackbar').hidden = false
        clearTimeout(snackTimer)
        snackTimer = setTimeout(() => { $('snackbar').hidden = true }, 6000)
    }
    $('snackUndo').onclick = () => { if (undoFn) undoFn(); $('snackbar').hidden = true; render() }

    function update(id, patch, msg, undoPatch) {
        const n = getNote(id); if (!n) return
        const prev = {}
        Object.keys(patch).forEach(k => { prev[k] = n[k] })
        Object.assign(n, patch, { updated: Date.now() })
        saveNotes(); render()
        if (msg) snack(msg, () => { Object.assign(n, undoPatch || prev); saveNotes() })
    }

    function act(id, a, btn) {
        const n = getNote(id); if (!n) return
        switch (a) {
            case 'pin': update(id, { pinned: !n.pinned, archived: false }, n.pinned ? 'Note unpinned' : 'Note pinned'); break
            case 'archive': update(id, { archived: !n.archived, pinned: false }, n.archived ? 'Note unarchived' : 'Note archived'); break
            case 'restore': update(id, { trashed: false, trashedAt: null }, 'Note restored'); break
            case 'deleteForever':
                if (confirm('Delete this note forever?')) { notes = notes.filter(x => x.id !== id); saveNotes(); render(); closeModal(true) }
                break
            case 'color': openColors(btn, c => update(id, { color: c })); break
            case 'more': openMore(btn, n); break
        }
    }

    function trash(id) {
        update(id, { trashed: true, trashedAt: Date.now(), pinned: false }, 'Note trashed')
        closeModal(true)
    }

    function copyNote(n) {
        const c = JSON.parse(JSON.stringify(n))
        c.id = uid(); c.title = c.title ? c.title + ' (copy)' : ''; c.order = nextOrder(); c.pinned = false
        if (c.items) c.items.forEach(i => { i.id = uid() })
        notes.push(c); saveNotes(); render(); snack('Note copied')
    }

    // ---------- popovers ----------
    const pop = $('popover')
    function showPop(html, anchor) {
        pop.innerHTML = html
        pop.hidden = false
        const r = anchor.getBoundingClientRect()
        pop.style.left = '0px'; pop.style.top = '0px'
        const pw = pop.offsetWidth, ph = pop.offsetHeight
        pop.style.left = Math.max(4, Math.min(r.left, innerWidth - pw - 8)) + 'px'
        pop.style.top = (r.bottom + ph > innerHeight ? Math.max(4, r.top - ph) : r.bottom) + 'px'
    }
    const closePop = () => { pop.hidden = true; pop.innerHTML = ''; pop.onclick = null }
    document.addEventListener('mousedown', e => {
        if (!pop.hidden && !pop.contains(e.target)) closePop()
        if (!$('accountMenu').hidden && !e.target.closest('.account')) $('accountMenu').hidden = true
    })

    function openColors(anchor, cb, current) {
        showPop(`<div class="colors">${COLORS.map(c => `<div class="swatch ${c === current ? 'sel' : ''}" data-c="${c}" title="${COLOR_NAMES[c] || c[0].toUpperCase() + c.slice(1)}" style="background:var(--c-${c})">${c === current ? icon('check') : ''}</div>`).join('')}</div>`, anchor)
        pop.onclick = e => { const s = e.target.closest('.swatch'); if (s) { cb(s.dataset.c); closePop() } }
    }

    function openMore(anchor, n) {
        showPop(`<div class="mi" data-m="trash">Delete note</div><div class="mi" data-m="label">${n.labels.length ? 'Change labels' : 'Add label'}</div><div class="mi" data-m="copy">Make a copy</div><div class="mi" data-m="checkbox">${n.items ? 'Hide tick boxes' : 'Show tick boxes'}</div>${n.items && n.items.some(i => i.done) ? '<div class="mi" data-m="deldone">Delete ticked items</div>' : ''}`, anchor)
        pop.onclick = e => {
            const m = e.target.closest('.mi'); if (!m) return
            closePop()
            if (m.dataset.m === 'trash') trash(n.id)
            if (m.dataset.m === 'copy') copyNote(n)
            if (m.dataset.m === 'label') openLabelPicker(anchor, n.labels, ls => { update(n.id, { labels: ls }); if (editingId === n.id) refreshModal() })
            if (m.dataset.m === 'checkbox') { toggleItems(n); if (editingId === n.id) refreshModal() }
            if (m.dataset.m === 'deldone') { update(n.id, { items: n.items.filter(i => !i.done) }); if (editingId === n.id) refreshModal() }
        }
    }

    function toggleItems(n) {
        if (n.items) { n.body = n.items.map(i => i.text).join('\n'); n.items = null }
        else { n.items = n.body.split('\n').filter(l => l.trim()).map(t => ({ id: uid(), text: t, done: false })); n.body = '' }
        n.updated = Date.now(); saveNotes(); render()
    }

    function openLabelPicker(anchor, current, cb) {
        const draw = (filter = '') => {
            const f = filter.trim()
            const list = labels.filter(l => l.toLowerCase().includes(f.toLowerCase()))
            const create = f && !labels.some(l => l.toLowerCase() === f.toLowerCase())
            pop.querySelector('.list').innerHTML = list.map(l => `<label><input type="checkbox" value="${esc(l)}" ${current.includes(l) ? 'checked' : ''}> ${esc(l)}</label>`).join('') +
                (create ? `<div class="mi" data-create="1">+ Create "${esc(f)}"</div>` : '')
        }
        showPop(`<div class="lbl"><div class="head" style="padding:0 0 6px">Label note</div><input type="text" placeholder="Enter label name"><div class="list"></div></div>`, anchor)
        draw()
        const inp = pop.querySelector('input[type=text]')
        inp.focus()
        inp.oninput = () => draw(inp.value)
        pop.onchange = e => {
            if (e.target.type !== 'checkbox') return
            current = e.target.checked ? [...current, e.target.value] : current.filter(l => l !== e.target.value)
            cb(current)
        }
        pop.onclick = e => {
            if (!e.target.dataset.create) return
            const name = inp.value.trim()
            labels.push(name); labels.sort((a, b) => a.localeCompare(b)); saveLabels()
            current = [...current, name]; cb(current); inp.value = ''; draw(); renderNav()
        }
    }

    function openLabelEditor() {
        const back = $('modalBack'), m = $('modal')
        const draw = () => {
            m.className = 'note'; m.style.background = 'var(--bg)'
            m.style.width = '300px'
            m.innerHTML = `<div class="head" style="padding:16px 16px 8px;font-weight:500">Edit labels</div>
              <div style="padding:0 16px"><input id="newLbl" placeholder="Create new label" style="width:100%;border:0;border-bottom:1px solid var(--border);background:none;color:inherit;outline:0;padding:6px 0"></div>
              <div style="padding:8px 16px;max-height:50vh;overflow:auto">${labels.map((l, i) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">${icon('label')}<input data-i="${i}" value="${esc(l)}" style="flex:1;border:0;background:none;color:inherit;outline:0;border-bottom:1px solid transparent"><button class="icon-btn" data-del="${i}" style="width:32px;height:32px">${icon('delete')}</button></div>`).join('')}</div>
              <div class="toolbar" style="justify-content:flex-end;opacity:1"><button class="text-btn" id="lblDone">Done</button></div>`
        }
        draw(); back.hidden = false
        const done = () => { back.hidden = true; m.style.width = ''; m.className = 'note'; labelEditorOpen = false; render() }
        labelEditorOpen = true
        m.onclick = e => {
            if (e.target.id === 'lblDone') return done()
            const b = e.target.closest('[data-del]')
            if (b && confirm('We\'ll delete this label and remove it from all notes. Your notes won\'t be deleted.')) {
                const l = labels[+b.dataset.del]
                labels.splice(+b.dataset.del, 1); notes.forEach(n => { n.labels = n.labels.filter(x => x !== l) })
                saveLabels(); saveNotes(); draw()
            }
        }
        m.onkeydown = e => {
            if (e.key !== 'Enter') return
            if (e.target.id === 'newLbl') {
                const v = e.target.value.trim()
                if (v && !labels.includes(v)) { labels.push(v); labels.sort((a, b) => a.localeCompare(b)); saveLabels(); draw(); $('newLbl').focus() }
            }
        }
        m.onchange = e => {
            if (e.target.dataset.i === undefined) return
            const i = +e.target.dataset.i, old = labels[i], v = e.target.value.trim()
            if (!v || (labels.includes(v) && v !== old)) { e.target.value = old; return }
            labels[i] = v; notes.forEach(n => { n.labels = n.labels.map(x => x === old ? v : x) })
            saveLabels(); saveNotes()
        }
        back.onmousedown = e => { if (e.target === back) done() }
    }
    let labelEditorOpen = false

    // ---------- card events ----------
    $('notesArea').addEventListener('click', e => {
        const card = e.target.closest('.note'); if (!card) return
        const id = card.dataset.id
        const cb = e.target.closest('input[data-item]')
        if (cb) {
            const n = getNote(id), it = n.items.find(i => i.id === cb.dataset.item)
            it.done = cb.checked; n.updated = Date.now(); saveNotes(); render(); return
        }
        const btn = e.target.closest('[data-act]')
        if (btn) { e.stopPropagation(); return act(id, btn.dataset.act, btn) }
        openModal(id)
    })

    // drag & drop reorder
    $('notesArea').addEventListener('dragstart', e => {
        const c = e.target.closest('.note'); if (!c) return
        dragId = c.dataset.id; c.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
    })
    $('notesArea').addEventListener('dragend', e => { dragId = null; render() })
    $('notesArea').addEventListener('dragover', e => { if (dragId) e.preventDefault() })
    $('notesArea').addEventListener('drop', e => {
        const t = e.target.closest('.note')
        if (!dragId || !t || t.dataset.id === dragId) return
        e.preventDefault()
        const a = getNote(dragId), b = getNote(t.dataset.id)
        const ordered = notes.filter(n => !n.trashed && n.pinned === b.pinned && n.archived === b.archived).sort(byOrder)
        const without = ordered.filter(n => n !== a)
        without.splice(without.indexOf(b), 0, a)
        a.pinned = b.pinned
        let o = orderCounter + without.length
        without.forEach(n => { n.order = o--; })
        orderCounter += without.length
        saveNotes(); dragId = null; render()
    })

    // ---------- composer ----------
    const comp = { pinned: false, color: 'default', labels: [], items: null, archived: false }
    const resetComp = () => Object.assign(comp, { pinned: false, color: 'default', labels: [], items: null, archived: false })

    function compItemsRender(focusLast) {
        const wrap = $('cItems')
        wrap.innerHTML = comp.items.map(i => `<div class="item" data-id="${i.id}"><input type="checkbox" ${i.done ? 'checked' : ''}><div class="txt" contenteditable="true" data-ph="List item">${esc(i.text)}</div><button class="icon-btn rm">${icon('close')}</button></div>`).join('') +
            `<div class="item add">${icon('add')}<input class="new" placeholder="List item"></div>`
        if (focusLast) wrap.querySelector('.new').focus()
    }
    function compMode(list) {
        if (list && !comp.items) {
            comp.items = $('cBody').innerText.split('\n').filter(l => l.trim()).map(t => ({ id: uid(), text: t, done: false }))
            $('cBody').hidden = true; $('cItems').hidden = false; compItemsRender(true)
        } else if (!list && comp.items) {
            $('cBody').innerText = comp.items.map(i => i.text).join('\n')
            comp.items = null; $('cBody').hidden = false; $('cItems').hidden = true
        }
    }
    function compTools() {
        $('cTools').innerHTML = `<button class="icon-btn" data-c="color" title="Background options">${icon('palette')}</button>
            <button class="icon-btn" data-c="label" title="Add label">${icon('label')}</button>
            <button class="icon-btn" data-c="archive" title="Archive">${icon(comp.archived ? 'unarchive' : 'archive')}</button>
            <button class="icon-btn" data-c="list" title="${comp.items ? 'Hide tick boxes' : 'Show tick boxes'}">${icon('check_box')}</button>`
    }
    function openComposer(list) {
        $('composer').classList.remove('collapsed')
        $('composerCollapsed').hidden = true; $('composerExpanded').hidden = false
        compTools(); compChips()
        $('cPin').classList.toggle('on', comp.pinned)
        if (list) { compMode(true); } else $('cBody').focus()
    }
    function compChips() { $('cChips').innerHTML = comp.labels.map(l => `<span class="chip">${esc(l)}</span>`).join('') }
    function closeComposer() {
        const n = {
            id: uid(), title: $('cTitle').value, body: comp.items ? '' : $('cBody').innerText.replace(/\n$/, ''),
            items: comp.items ? comp.items.filter(i => i.text.trim()) : null,
            color: comp.color, pinned: comp.pinned, archived: comp.archived, trashed: false, labels: comp.labels.slice(),
            created: Date.now(), updated: Date.now(), order: nextOrder()
        }
        if (comp.items) {
            const pending = $('cItems').querySelector('.new').value.trim()
            if (pending) n.items.push({ id: uid(), text: pending, done: false })
        }
        if (!isEmpty(n)) {
            if (n.archived) n.pinned = false
            notes.push(n); saveNotes()
            if (n.archived) snack('Note archived')
        }
        $('cTitle').value = ''; $('cBody').innerHTML = ''; $('cItems').innerHTML = ''
        $('cBody').hidden = false; $('cItems').hidden = true
        $('composer').style.background = ''
        resetComp()
        $('composer').classList.add('collapsed')
        $('composerCollapsed').hidden = false; $('composerExpanded').hidden = true
        render()
    }
    $('composerCollapsed').addEventListener('click', e => openComposer(!!e.target.closest('#newListBtn')))
    $('cClose').onclick = closeComposer
    $('cPin').onclick = () => { comp.pinned = !comp.pinned; $('cPin').classList.toggle('on', comp.pinned) }
    $('cTools').addEventListener('click', e => {
        const b = e.target.closest('[data-c]'); if (!b) return
        const k = b.dataset.c
        if (k === 'color') openColors(b, c => { comp.color = c; $('composer').style.background = `var(--c-${c})` }, comp.color)
        if (k === 'label') openLabelPicker(b, comp.labels, ls => { comp.labels = ls; compChips() })
        if (k === 'archive') { comp.archived = !comp.archived; compTools() }
        if (k === 'list') { compMode(!comp.items); compTools() }
    })
    $('cTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); comp.items ? $('cItems').querySelector('.new')?.focus() : $('cBody').focus() } })
    $('cItems').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (e.target.classList.contains('new')) {
            const v = e.target.value.trim()
            if (v) { comp.items.push({ id: uid(), text: v, done: false }); e.target.value = ''; compItemsRender(true) }
        } else e.target.closest('.item').nextElementSibling.querySelector('.new, .txt')?.focus()
    })
    $('cItems').addEventListener('input', e => {
        const row = e.target.closest('.item'); if (!row || !row.dataset.id) return
        comp.items.find(i => i.id === row.dataset.id).text = e.target.innerText
    })
    $('cItems').addEventListener('click', e => {
        const row = e.target.closest('.item'); if (!row || !row.dataset.id) return
        const it = comp.items.find(i => i.id === row.dataset.id)
        if (e.target.type === 'checkbox') { it.done = e.target.checked; row.classList.toggle('done', it.done) }
        if (e.target.closest('.rm')) { comp.items = comp.items.filter(i => i !== it); compItemsRender() }
    })
    $('cItems').addEventListener('focusout', e => {
        if (e.target.classList.contains('new') && e.target.value.trim()) {
            comp.items.push({ id: uid(), text: e.target.value.trim(), done: false }); e.target.value = ''
            if (!$('cItems').contains(e.relatedTarget)) compItemsRender()
        }
    })
    document.addEventListener('mousedown', e => {
        if (!$('composer').classList.contains('collapsed') && !$('composer').contains(e.target) && !pop.contains(e.target) && $('modalBack').hidden && !e.target.closest('#snackbar')) closeComposer()
    })

    // ---------- edit modal ----------
    function modalFooter(n) {
        return `<div class="stamp">Edited ${new Date(n.updated).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            <div class="toolbar"><div class="tools">${tools(n)}</div><button class="text-btn" data-act="close">Close</button></div>`
    }
    function refreshModal() {
        const n = getNote(editingId); if (!n) return
        const m = $('modal')
        m.style.background = `var(--c-${n.color})`
        m.innerHTML = noteHtml(n, true) + (n.items && !n.trashed ? `<div class="item add" style="padding:4px 16px">${icon('add')}<input class="new" placeholder="List item"></div>` : '') + modalFooter(n)
        if (n.trashed) m.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = 'false')
        if (n.items) m.querySelectorAll('.item:not(.add) .txt').forEach(el => { el.contentEditable = n.trashed ? 'false' : 'true' })
        m.querySelectorAll('.item:not(.add)').forEach((row, idx) => {
            if (n.trashed) return
            row.insertAdjacentHTML('beforeend', `<button class="icon-btn rm" data-rm="1">${icon('close')}</button>`)
        })
    }
    function openModal(id) {
        const n = getNote(id); if (!n) return
        editingId = id
        const m = $('modal'); m.onclick = m.onkeydown = m.onchange = null; m.style.width = ''
        refreshModal()
        $('modalBack').hidden = false
        closePop()
        wireModal()
        // hide card while editing is unnecessary; keep simple
    }
    function readModal() {
        const n = getNote(editingId); if (!n || n.trashed) return
        const m = $('modal')
        n.title = m.querySelector('#mTitle')?.innerText.replace(/\n$/, '') ?? n.title
        if (!n.items) n.body = m.querySelector('#mBody')?.innerText.replace(/\n$/, '') ?? n.body
    }
    function closeModal(silent) {
        if (!editingId) { $('modalBack').hidden = true; return }
        const n = getNote(editingId)
        if (n && !silent) {
            readModal()
            if (n.items) n.items = n.items.filter(i => i.text.trim())
            if (isEmpty(n)) { notes = notes.filter(x => x !== n) }
            else n.updated = Date.now()
            saveNotes()
        }
        editingId = null
        $('modalBack').hidden = true
        render()
    }
    function wireModal() {
        const m = $('modal')
        let timer
        const touch = () => { const n = getNote(editingId); if (n) { n.updated = Date.now() } }
        m.oninput = e => {
            const n = getNote(editingId); if (!n) return
            if (e.target.id === 'mTitle') n.title = e.target.innerText
            else if (e.target.id === 'mBody') n.body = e.target.innerText
            else if (e.target.classList.contains('txt')) {
                const row = e.target.closest('.item'), idx = [...m.querySelectorAll('.item:not(.add)')].indexOf(row)
                const open = n.items.filter(i => !i.done), done = n.items.filter(i => i.done)
                const all = [...open, ...done]
                if (all[idx]) all[idx].text = e.target.innerText
            }
            touch(); clearTimeout(timer); timer = setTimeout(saveNotes, 300)
        }
        m.onclick = e => {
            const n = getNote(editingId); if (!n) return
            const cb = e.target.closest('input[type=checkbox]')
            if (cb && n.items) {
                const idx = [...m.querySelectorAll('.item:not(.add)')].indexOf(cb.closest('.item'))
                const all = [...n.items.filter(i => !i.done), ...n.items.filter(i => i.done)]
                all[idx].done = cb.checked; touch(); saveNotes(); refreshModal(); return
            }
            const rm = e.target.closest('[data-rm]')
            if (rm) {
                const idx = [...m.querySelectorAll('.item:not(.add)')].indexOf(rm.closest('.item'))
                const all = [...n.items.filter(i => !i.done), ...n.items.filter(i => i.done)]
                n.items = n.items.filter(i => i !== all[idx]); touch(); saveNotes(); refreshModal(); return
            }
            const rl = e.target.closest('[data-rmlabel]')
            if (rl) { n.labels = n.labels.filter(l => l !== rl.dataset.rmlabel); saveNotes(); refreshModal(); return }
            const b = e.target.closest('[data-act]'); if (!b) return
            const a = b.dataset.act
            if (a === 'close') return closeModal()
            if (a === 'archive') { readModal(); const was = n.archived; n.archived = !was; n.pinned = false; saveNotes(); closeModal(); snack(was ? 'Note unarchived' : 'Note archived', () => { n.archived = was; saveNotes() }); return }
            if (a === 'pin') { n.pinned = !n.pinned; if (n.pinned) n.archived = false; saveNotes(); refreshModal(); return }
            if (a === 'color') return openColors(b, c => { n.color = c; saveNotes(); $('modal').style.background = `var(--c-${c})` }, n.color)
            if (a === 'more') return openMore(b, n)
            if (a === 'restore') { n.trashed = false; n.trashedAt = null; saveNotes(); closeModal(true); snack('Note restored'); return }
            if (a === 'deleteForever') return act(n.id, a, b)
        }
        m.onkeydown = e => {
            const n = getNote(editingId); if (!n || !n.items) return
            if (e.target.classList.contains('new') && e.key === 'Enter') {
                e.preventDefault()
                const v = e.target.value.trim()
                if (v) { n.items.push({ id: uid(), text: v, done: false }); e.target.value = ''; saveNotes(); refreshModal(); m.querySelector('.new').focus() }
            } else if (e.target.classList.contains('txt') && e.key === 'Enter') {
                e.preventDefault(); m.querySelector('.new')?.focus()
            }
        }
    }
    $('modalBack').addEventListener('mousedown', e => { if (e.target === $('modalBack') && !labelEditorOpen) closeModal() })
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (!pop.hidden) closePop()
            else if (!$('modalBack').hidden && !labelEditorOpen) closeModal()
            else if (!$('composer').classList.contains('collapsed')) closeComposer()
            else if (query) { $('searchInput').value = ''; $('searchInput').dispatchEvent(new Event('input')) }
        }
    })

    // ---------- top bar ----------
    $('searchInput').addEventListener('input', e => {
        query = e.target.value.trim()
        $('clearSearch').hidden = !query
        render()
    })
    $('clearSearch').onclick = () => { $('searchInput').value = ''; query = ''; $('clearSearch').hidden = true; render() }
    $('menuBtn').onclick = () => {
        if (innerWidth <= 800) document.body.classList.toggle('navopen')
        else { prefs.mini = !prefs.mini; savePrefs(); applyPrefs() }
    }
    $('refreshBtn').onclick = () => location.reload()
    $('viewBtn').onclick = () => { prefs.view = prefs.view === 'grid' ? 'list' : 'grid'; savePrefs(); applyPrefs(); render() }
    $('themeBtn').onclick = () => { prefs.dark = !prefs.dark; savePrefs(); applyPrefs() }
    $('logoText').parentElement.style.cursor = 'pointer'
    $('logoText').parentElement.onclick = () => { view = { type: 'notes', label: null }; $('clearSearch').click() }
    $('avatarBtn').onclick = () => { $('accountMenu').hidden = !$('accountMenu').hidden }
    $('signOutBtn').onclick = () => { localStorage.removeItem('currentUser'); window.location.href = 'signin.html' }
    $('emptyTrash').onclick = () => {
        if (confirm('Empty Trash? All notes in Trash will be permanently deleted.')) { notes = notes.filter(n => !n.trashed); saveNotes(); render() }
    }

    function applyPrefs() {
        document.body.classList.toggle('dark', prefs.dark)
        document.body.classList.toggle('mini', prefs.mini)
        $('viewBtn').innerHTML = icon(prefs.view === 'grid' ? 'view_agenda' : 'grid_view')
        $('viewBtn').title = prefs.view === 'grid' ? 'List view' : 'Grid view'
        $('themeBtn').innerHTML = icon(prefs.dark ? 'light_mode' : 'dark_mode')
        setTimeout(layout, 160)
    }

    const initial = ((user.fName || user.mail)[0] || '?').toUpperCase()
    $('avatarBtn').textContent = initial; $('avatarBig').textContent = initial
    $('accName').textContent = [user.fName, user.lName].filter(Boolean).join(' ')
    $('accMail').textContent = user.mail
    if ('ontouchstart' in window) document.body.classList.add('touch')

    applyPrefs()
    render()
    if (document.fonts) document.fonts.ready.then(layout)
})()
