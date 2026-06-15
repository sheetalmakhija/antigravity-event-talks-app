/**
 * FRONTEND LOGIC & INTERACTIVITY
 * BigQuery Release Explorer
 * ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Cache
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const statusText = document.getElementById('statusText');
    
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
        fetchReleaseNotes();
        setupEventListeners();
    }

    // Event Listeners
    function setupEventListeners() {
        // Refresh feed
        refreshBtn.addEventListener('click', () => {
            fetchReleaseNotes(true);
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
            
            // Show alert or handle error display
            alert(`Error loading release notes: ${error.message}\nMake sure your Flask server is running.`);
        } finally {
            setLoadingState(false);
        }
    }

    // Manage spinner and display states during fetch
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshIcon.classList.add('icon-spin');
            refreshBtn.disabled = true;
            feedSkeleton.style.display = 'block';
            releaseNotesFeed.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            refreshIcon.classList.remove('icon-spin');
            refreshBtn.disabled = false;
            feedSkeleton.style.display = 'none';
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
                        <div class="selection-indicator">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    `;
                    
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
        } else {
            releaseNotesFeed.style.display = 'none';
            emptyState.style.display = 'block';
        }
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
        } else if (length > 280) {
            tweetCharCounter.classList.add('danger');
        }
    }
});
