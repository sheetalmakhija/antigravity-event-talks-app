/**
 * FRONTEND LOGIC & INTERACTIVITY
 * BigQuery Release Explorer
 * ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Cache
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const statusText = document.getElementById('statusText');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
    
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const typeFilters = document.getElementById('typeFilters');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    const statTotal = document.getElementById('statTotal');
    const statFeatures = document.getElementById('statFeatures');
    const statBreaking = document.getElementById('statBreaking');
    
    const feedSkeleton = document.getElementById('feedSkeleton');
    const emptyState = document.getElementById('emptyState');
    const releaseNotesFeed = document.getElementById('releaseNotesFeed');
    
    const detailPanel = document.getElementById('detailPanel');
    const noSelectionState = document.getElementById('noSelectionState');
    const detailContent = document.getElementById('detailContent');
    const detailTypeBadge = document.getElementById('detailTypeBadge');
    const detailDateText = document.getElementById('detailDateText');
    const detailSourceLink = document.getElementById('detailSourceLink');
    const detailHtmlContent = document.getElementById('detailHtmlContent');
    
    const tweetTextarea = document.getElementById('tweetTextarea');
    const tweetCharCounter = document.getElementById('tweetCharCounter');
    const copyTextBtn = document.getElementById('copyTextBtn');
    const copyTextBtnText = document.getElementById('copyTextBtnText');
    const tweetBtn = document.getElementById('tweetBtn');

    // App State
    let rawFeedData = [];
    let activeFilterType = 'all';
    let searchQuery = '';
    let selectedUpdateId = null; // format: 'dateIndex-updateIndex'
    let selectedUpdateData = null;

    // Initialize application
    init();

    function init() {
        // Initialize Theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            themeToggleCheckbox.checked = true;
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            themeToggleCheckbox.checked = false;
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Initialize Filters/Search from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const qParam = urlParams.get('q');
        const typeParam = urlParams.get('type');
        
        if (qParam) {
            searchQuery = qParam.toLowerCase();
            searchInput.value = qParam;
            clearSearchBtn.style.display = 'block';
        }
        
        if (typeParam) {
            activeFilterType = typeParam.toLowerCase();
            typeFilters.querySelectorAll('.filter-tag').forEach(btn => {
                if (btn.getAttribute('data-type') === activeFilterType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        fetchReleaseNotes();
        setupEventListeners();
    }

    // Event Listeners
    function setupEventListeners() {
        // Refresh feed
        refreshBtn.addEventListener('click', () => {
            fetchReleaseNotes(true);
        });

        // Export to CSV
        exportCsvBtn.addEventListener('click', () => {
            exportToCsv();
        });

        // Theme Switch Toggle
        themeToggleCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });

        // Search input
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            clearSearchBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
            renderFeed();
        });

        // Clear search
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            searchInput.focus();
            renderFeed();
        });

        // Filter tags
        typeFilters.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-tag');
            if (!btn) return;
            
            // Toggle active classes
            typeFilters.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            activeFilterType = btn.getAttribute('data-type');
            renderFeed();
        });

        // Reset filters in empty state
        resetFiltersBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            
            typeFilters.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
            typeFilters.querySelector('[data-type="all"]').classList.add('active');
            activeFilterType = 'all';
            
            renderFeed();
        });

        // Tweet textarea character counter
        tweetTextarea.addEventListener('input', () => {
            updateTweetCharCount();
        });

        // Copy Tweet Text
        copyTextBtn.addEventListener('click', () => {
            const text = tweetTextarea.value;
            navigator.clipboard.writeText(text).then(() => {
                copyTextBtnText.textContent = 'Copied!';
                copyTextBtn.classList.remove('btn-secondary');
                copyTextBtn.classList.add('btn-primary');
                setTimeout(() => {
                    copyTextBtnText.textContent = 'Copy Text';
                    copyTextBtn.classList.remove('btn-primary');
                    copyTextBtn.classList.add('btn-secondary');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy text', 'error');
            });
        });

        // Share on Twitter
        tweetBtn.addEventListener('click', () => {
            const tweetText = tweetTextarea.value;
            const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
            window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        });
    }

    // Fetch releases from local Flask API
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'partial_error') {
                rawFeedData = result.data;
                
                // Format last updated string
                if (result.last_updated) {
                    statusText.textContent = `Sync: ${result.last_updated}`;
                } else {
                    statusText.textContent = 'Synced';
                }
                
                // If there's a partial error, log it
                if (result.status === 'partial_error') {
                    console.warn('Backend warning: ', result.message);
                }
                
                calculateStats();
                renderFeed();
            } else {
                throw new Error(result.message || 'Unknown error occurred.');
            }
        } catch (error) {
            console.error('Failed to retrieve release notes:', error);
            statusText.textContent = 'Sync failed';
            showToast(`Sync failed: ${error.message}`, 'error');
        } finally {
            setLoadingState(false);
        }
    }

    // Manage spinner and display states during fetch
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshIcon.classList.add('icon-spin');
            refreshBtn.disabled = true;
            exportCsvBtn.style.display = 'none';
            feedSkeleton.style.display = 'block';
            releaseNotesFeed.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            refreshIcon.classList.remove('icon-spin');
            refreshBtn.disabled = false;
            feedSkeleton.style.display = 'none';
            if (rawFeedData && rawFeedData.length > 0) {
                exportCsvBtn.style.display = 'inline-flex';
            }
        }
    }

    // Calculate count totals for the stats box
    function calculateStats() {
        let total = 0;
        let features = 0;
        let breaking = 0;

        rawFeedData.forEach(entry => {
            entry.updates.forEach(update => {
                total++;
                const type = update.type.toLowerCase();
                if (type.includes('feature')) features++;
                if (type.includes('breaking')) breaking++;
            });
        });

        statTotal.textContent = total;
        statFeatures.textContent = features;
        statBreaking.textContent = breaking;
    }

    // Filter and display the releases timeline
    function renderFeed() {
        releaseNotesFeed.innerHTML = '';
        let hasMatches = false;

        rawFeedData.forEach((entry, entryIndex) => {
            // Filter the updates in this entry
            const filteredUpdates = entry.updates.filter((update, updateIndex) => {
                // 1. Category Filter
                if (activeFilterType !== 'all') {
                    const updateType = update.type.toLowerCase();
                    // Maps general or specific tags
                    if (activeFilterType === 'feature' && !updateType.includes('feature')) return false;
                    if (activeFilterType === 'change' && !updateType.includes('change')) return false;
                    if (activeFilterType === 'breaking' && !updateType.includes('breaking')) return false;
                    if (activeFilterType === 'announcement' && !updateType.includes('announcement')) return false;
                    if (activeFilterType === 'issue' && !updateType.includes('issue')) return false;
                }

                // 2. Text Search Query Filter
                if (searchQuery) {
                    const typeText = update.type.toLowerCase();
                    const bodyText = update.text.toLowerCase();
                    const dateText = entry.date.toLowerCase();
                    
                    const isMatch = typeText.includes(searchQuery) || 
                                    bodyText.includes(searchQuery) || 
                                    dateText.includes(searchQuery);
                    if (!isMatch) return false;
                }

                return true;
            });

            // If we have updates that match, render this date node
            if (filteredUpdates.length > 0) {
                hasMatches = true;
                
                const groupEl = document.createElement('div');
                groupEl.className = 'timeline-group';
                
                // Create Date Header
                groupEl.innerHTML = `
                    <div class="timeline-date-header">
                        <div class="timeline-node">
                            <div class="timeline-node-inner"></div>
                        </div>
                        <span class="date-bubble">${entry.date}</span>
                    </div>
                    <div class="timeline-cards" id="cards-container-${entryIndex}"></div>
                `;
                
                releaseNotesFeed.appendChild(groupEl);
                const cardsContainer = document.getElementById(`cards-container-${entryIndex}`);
                
                // Append update cards
                filteredUpdates.forEach(update => {
                    const updateIndex = entry.updates.indexOf(update);
                    const updateId = `${entryIndex}-${updateIndex}`;
                    
                    const cardEl = document.createElement('article');
                    cardEl.className = `update-card ${selectedUpdateId === updateId ? 'selected' : ''}`;
                    cardEl.setAttribute('data-id', updateId);
                    cardEl.setAttribute('data-type', update.type);
                    
                    cardEl.innerHTML = `
                        <div class="card-header">
                            <span class="update-badge" data-type="${update.type}">${update.type}</span>
                            <span class="card-date">${entry.date}</span>
                        </div>
                        <div class="card-body">
                            ${update.html}
                        </div>
                        <button class="card-copy-btn" title="Copy update to clipboard" aria-label="Copy update to clipboard" data-tooltip="Copy">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <div class="selection-indicator">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    `;
                    
                    // Copy button event listener
                    const copyBtn = cardEl.querySelector('.card-copy-btn');
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Avoid triggering card selection click
                        navigator.clipboard.writeText(update.text).then(() => {
                            copyBtn.classList.add('copied');
                            copyBtn.setAttribute('data-tooltip', 'Copied!');
                            showToast('Copied update to clipboard!', 'success');
                            copyBtn.innerHTML = `
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            `;
                            setTimeout(() => {
                                copyBtn.classList.remove('copied');
                                copyBtn.setAttribute('data-tooltip', 'Copy');
                                copyBtn.innerHTML = `
                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                `;
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy card text: ', err);
                            showToast('Failed to copy text', 'error');
                        });
                    });
                    
                    // Clicking selects the card
                    cardEl.addEventListener('click', () => {
                        selectUpdate(updateId, entry, update);
                    });
                    
                    cardsContainer.appendChild(cardEl);
                });
            }
        });

        // Toggle feed / empty state
        if (hasMatches) {
            releaseNotesFeed.style.display = 'block';
            emptyState.style.display = 'none';

            // Auto-select first update if nothing is selected yet
            if (!selectedUpdateId) {
                const firstCard = releaseNotesFeed.querySelector('.update-card');
                if (firstCard) {
                    const firstId = firstCard.getAttribute('data-id');
                    const parts = firstId.split('-');
                    const entryIdx = parseInt(parts[0]);
                    const updateIdx = parseInt(parts[1]);
                    const entry = rawFeedData[entryIdx];
                    const update = entry.updates[updateIdx];
                    selectUpdate(firstId, entry, update);
                }
            }
        } else {
            releaseNotesFeed.style.display = 'none';
            emptyState.style.display = 'block';
        }

        updateUrlParams();
    }

    // Select release note item to display details
    function selectUpdate(updateId, entry, update) {
        // Toggle selected styling
        document.querySelectorAll('.update-card').forEach(card => {
            if (card.getAttribute('data-id') === updateId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        selectedUpdateId = updateId;
        selectedUpdateData = { entry, update };

        // Show detailed panel contents
        noSelectionState.style.display = 'none';
        detailContent.style.display = 'flex';

        // Set badge & header
        detailTypeBadge.textContent = update.type;
        detailTypeBadge.setAttribute('data-type', update.type);
        detailDateText.textContent = entry.date;
        detailSourceLink.href = entry.link || '#';

        // Content
        detailHtmlContent.innerHTML = update.html;

        // Draft Tweet Composer
        composeTweetDraft(entry.date, update.type, update.text, entry.link);
    }

    // Automatically draft a Twitter post that fits X's 280 char limit
    function composeTweetDraft(date, type, text, link) {
        // Format headers & footers
        const emojiMap = {
            'Feature': '🚀',
            'Change': '🔄',
            'Breaking': '⚠️',
            'Announcement': '📢',
            'Issue': '🛠️',
            'General': '⚡'
        };
        const emoji = emojiMap[type] || '📢';
        
        const header = `${emoji} BigQuery Update (${date}):\n`;
        const footer = `\n\nDetails: ${link}\n#BigQuery #GoogleCloud`;
        
        const maxTweetLength = 280;
        
        // Calculate remaining room for the update message body
        // Note: Twitter counts URL as 23 characters regardless of actual length!
        // We'll calculate actual text lengths, and use 23 chars for the link.
        const headerLength = header.length;
        const hashtagsLength = '\n\nDetails:  #BigQuery #GoogleCloud'.length;
        const urlCost = 23; // Fixed Twitter URL length cost
        const reservedSpace = headerLength + hashtagsLength + urlCost;
        
        const availableSpace = maxTweetLength - reservedSpace;
        
        let cleanedBodyText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanedBodyText.length > availableSpace) {
            // Truncate text and add ellipses
            cleanedBodyText = cleanedBodyText.substring(0, availableSpace - 3) + '...';
        }

        const draftText = `${header}${cleanedBodyText}${footer}`;
        
        tweetTextarea.value = draftText;
        updateTweetCharCount();
    }

    // Real-time character count calculations (adhering to Twitter URL rules)
    function updateTweetCharCount() {
        const text = tweetTextarea.value;
        
        // Calculate length taking Twitter's short URL count (23 characters) into account
        // Regex to match URLs starting with http or https
        const urlRegex = /https?:\/\/[^\s]+/g;
        let urlMatches = text.match(urlRegex) || [];
        
        // Replace all URL lengths with a placeholder of 23 characters
        let textForLengthCalc = text;
        urlMatches.forEach(url => {
            textForLengthCalc = textForLengthCalc.replace(url, 'a'.repeat(23));
        });
        
        const length = textForLengthCalc.length;
        
        tweetCharCounter.textContent = `${length} / 280`;

        // Styling indicators
        tweetCharCounter.className = 'char-counter';
        if (length > 240 && length <= 280) {
            tweetCharCounter.classList.add('warning');
            tweetBtn.disabled = false;
            tweetBtn.classList.remove('disabled-warning');
        } else if (length > 280) {
            tweetCharCounter.classList.add('danger');
            tweetBtn.disabled = true;
            tweetBtn.classList.add('disabled-warning');
        } else {
            tweetBtn.disabled = (length === 0);
            tweetBtn.classList.remove('disabled-warning');
        }
    }

    // Export visible updates to CSV format
    function exportToCsv() {
        const csvRows = [];
        // Header row
        csvRows.push(['Date', 'Type', 'Description', 'Link'].map(val => `"${val.replace(/"/g, '""')}"`).join(','));

        let count = 0;
        rawFeedData.forEach(entry => {
            entry.updates.forEach(update => {
                // Apply active filters
                const typeLower = update.type.toLowerCase();
                if (activeFilterType !== 'all') {
                    if (activeFilterType === 'feature' && !typeLower.includes('feature')) return;
                    if (activeFilterType === 'change' && !typeLower.includes('change')) return;
                    if (activeFilterType === 'breaking' && !typeLower.includes('breaking')) return;
                    if (activeFilterType === 'announcement' && !typeLower.includes('announcement')) return;
                    if (activeFilterType === 'issue' && !typeLower.includes('issue')) return;
                }

                // Apply search filter
                if (searchQuery) {
                    const bodyLower = update.text.toLowerCase();
                    const dateLower = entry.date.toLowerCase();
                    const isMatch = typeLower.includes(searchQuery) || 
                                    bodyLower.includes(searchQuery) || 
                                    dateLower.includes(searchQuery);
                    if (!isMatch) return;
                }

                const cleanText = update.text.replace(/"/g, '""');
                const cleanDate = entry.date.replace(/"/g, '""');
                const cleanType = update.type.replace(/"/g, '""');
                const cleanLink = (entry.link || '').replace(/"/g, '""');

                csvRows.push([cleanDate, cleanType, cleanText, cleanLink].map(val => `"${val}"`).join(','));
                count++;
            });
        });

        if (count === 0) {
            showToast('No updates to export with current filters.', 'error');
            return;
        }

        const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${activeFilterType}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Sync parameters to the browser address bar
    function updateUrlParams() {
        const url = new URL(window.location.href);
        if (searchQuery) {
            url.searchParams.set('q', searchQuery);
        } else {
            url.searchParams.delete('q');
        }
        
        if (activeFilterType && activeFilterType !== 'all') {
            url.searchParams.set('type', activeFilterType);
        } else {
            url.searchParams.delete('type');
        }
        
        window.history.replaceState({}, '', url);
    }

    // Custom non-blocking Toast alert system
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        
        // Force reflow
        toast.offsetHeight;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
});
