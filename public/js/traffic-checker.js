// Traffic Checker JavaScript
class TrafficChecker {
  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.results = [];
    this.isChecking = false;
  }

  initializeElements() {
    // Input elements
    this.domainsTextarea = document.getElementById('domains');
    this.domainCount = document.getElementById('domain-count');
    this.remainingChecks = document.getElementById('remaining-checks');
    
    // Button elements
    this.checkBtn = document.getElementById('check-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.exportCsvBtn = document.getElementById('export-csv-btn');
    this.exportJsonBtn = document.getElementById('export-json-btn');
    
    // Progress elements
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    
    // Results elements
    this.resultsSection = document.getElementById('results-section');
    this.resultsTable = document.getElementById('results-table');
    this.resultsTableBody = document.getElementById('results-table-body');
    
    // Stats elements
    this.totalDomains = document.getElementById('total-domains');
    this.successfulCount = document.getElementById('successful-count');
    this.failedCount = document.getElementById('failed-count');
    this.avgVisits = document.getElementById('avg-visits');
  }

  bindEvents() {
    // Input events
    if (this.domainsTextarea) {
      this.domainsTextarea.addEventListener('input', () => this.updateDomainCount());
      this.domainsTextarea.addEventListener('paste', () => {
        setTimeout(() => this.updateDomainCount(), 10);
      });
    }
    
    // Button events
    if (this.checkBtn) {
      this.checkBtn.addEventListener('click', () => this.startTrafficCheck());
    }
    
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearAll());
    }
    
    if (this.exportCsvBtn) {
      this.exportCsvBtn.addEventListener('click', () => this.exportResults('csv'));
    }
    
    if (this.exportJsonBtn) {
      this.exportJsonBtn.addEventListener('click', () => this.exportResults('json'));
    }
    
    // Table sorting
    this.bindTableSorting();
  }

  updateDomainCount() {
    if (!this.domainsTextarea) return;
    
    const domains = this.getDomains();
    const count = domains.length;
    const remaining = Math.max(0, 50 - count);
    
    if (this.domainCount) {
      this.domainCount.textContent = `${count} domain${count !== 1 ? 's' : ''}`;
    }
    
    if (this.remainingChecks) {
      this.remainingChecks.textContent = `${remaining} checks remaining`;
    }
    
    // Update button state
    if (this.checkBtn) {
      this.checkBtn.disabled = count === 0 || count > 50 || this.isChecking;
    }
    
    // Show warning for too many domains
    if (count > 50) {
      this.domainsTextarea.classList.add('border-red-500');
      if (this.remainingChecks) {
        this.remainingChecks.textContent = 'Too many domains (max 50)';
        this.remainingChecks.classList.add('text-red-500');
      }
    } else {
      this.domainsTextarea.classList.remove('border-red-500');
      if (this.remainingChecks) {
        this.remainingChecks.classList.remove('text-red-500');
      }
    }
  }

  getDomains() {
    if (!this.domainsTextarea) return [];
    
    return this.domainsTextarea.value
      .split('\n')
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0);
  }

  async startTrafficCheck() {
    const domains = this.getDomains();
    
    if (domains.length === 0) {
      alert('Please enter at least one domain');
      return;
    }
    
    if (domains.length > 50) {
      alert('Maximum 50 domains allowed');
      return;
    }
    
    this.isChecking = true;
    this.updateButtonStates();
    this.showProgress();
    this.hideResults();
    
    try {
      const results = [];
      
      // Process domains one by one
      for (const domain of domains) {
        const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        
        try {
          const response = await fetch('/api/traffic-check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ domain: cleanDomain })
          });

          const data = await response.json();
          
          if (!response.ok) {
            results.push({
              domain: cleanDomain,
              monthlyVisits: 'N/A',
              status: `Error: ${response.status}`
            });
          } else {
            results.push({
              domain: data.domain,
              monthlyVisits: data.visits,
              status: data.status
            });
          }
        } catch (error) {
          console.error(`Error for domain ${cleanDomain}:`, error);
          results.push({
            domain: cleanDomain,
            monthlyVisits: 'N/A',
            status: 'Error'
          });
        }
      }
      
      this.results = results;
      this.displayResults();
      
    } catch (error) {
      console.error('Traffic check error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      this.isChecking = false;
      this.updateButtonStates();
      this.hideProgress();
    }
  }

  showProgress() {
    if (this.progressContainer) {
      this.progressContainer.classList.remove('hidden');
    }
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      
      if (this.progressBar) {
        this.progressBar.style.width = `${progress}%`;
      }
      if (this.progressText) {
        this.progressText.textContent = `${Math.round(progress)}%`;
      }
      
      if (!this.isChecking) {
        clearInterval(interval);
        if (this.progressBar) {
          this.progressBar.style.width = '100%';
        }
        if (this.progressText) {
          this.progressText.textContent = '100%';
        }
      }
    }, 200);
  }

  hideProgress() {
    if (this.progressContainer) {
      this.progressContainer.classList.add('hidden');
    }
  }

  displayResults() {
    this.updateStats();
    this.populateTable();
    this.showResults();
  }

  updateStats() {
    const total = this.results.length;
    const successful = this.results.filter(r => r.status === 'Success').length;
    const failed = total - successful;
    
    // Calculate average monthly visits
    const successfulResults = this.results.filter(r => r.status === 'Success' && r.monthlyVisits !== 'N/A');
    let avgVisitsValue = 'N/A';
    
    if (successfulResults.length > 0) {
      const totalVisits = successfulResults.reduce((sum, result) => {
        const visits = typeof result.monthlyVisits === 'number' ? result.monthlyVisits : 0;
        return sum + visits;
      }, 0);
      avgVisitsValue = Math.round(totalVisits / successfulResults.length).toLocaleString();
    }
    
    if (this.totalDomains) this.totalDomains.textContent = total;
    if (this.successfulCount) this.successfulCount.textContent = successful;
    if (this.failedCount) this.failedCount.textContent = failed;
    if (this.avgVisits) this.avgVisits.textContent = avgVisitsValue;
  }

  // Note: parseVisits and formatNumber functions removed - now using raw numbers

  populateTable() {
    if (!this.resultsTableBody) return;
    
    this.resultsTableBody.innerHTML = '';
    
    this.results.forEach(result => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      
      const statusClass = result.status === 'Success' ? 'text-green-600' : 'text-red-600';
      const statusBadgeClass = result.status === 'Success' 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800';
      
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
          ${this.escapeHtml(result.domain)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-base text-gray-900">
          ${typeof result.monthlyVisits === 'number' ? result.monthlyVisits.toLocaleString() : this.escapeHtml(result.monthlyVisits)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusBadgeClass}">
            ${this.escapeHtml(result.status)}
          </span>
        </td>
      `;
      
      this.resultsTableBody.appendChild(row);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showResults() {
    if (this.resultsSection) {
      this.resultsSection.classList.remove('hidden');
    }
    // Show export buttons when results are displayed
    if (window.ResultsTable && this.results.length > 0) {
      window.ResultsTable.showExportButton();
    }
  }

  hideResults() {
    if (this.resultsSection) {
      this.resultsSection.classList.add('hidden');
    }
    // Hide export buttons when results are hidden
    if (window.ResultsTable) {
      window.ResultsTable.hideExportButton();
    }
  }

  clearAll() {
    if (this.domainsTextarea) {
      this.domainsTextarea.value = '';
    }
    
    this.results = [];
    this.updateDomainCount();
    this.hideResults();
    this.hideProgress();
    
    // Ensure export buttons are hidden when clearing
    if (window.ResultsTable) {
      window.ResultsTable.hideExportButton();
    }
  }

  updateButtonStates() {
    const domains = this.getDomains();
    const hasValidDomains = domains.length > 0 && domains.length <= 50;
    
    if (this.checkBtn) {
      this.checkBtn.disabled = !hasValidDomains || this.isChecking;
      this.checkBtn.textContent = this.isChecking ? 'Analyzing...' : 'Analyze Traffic';
    }
    
    const hasResults = this.results.length > 0;
    if (this.exportCsvBtn) {
      this.exportCsvBtn.disabled = !hasResults;
    }
    if (this.exportJsonBtn) {
      this.exportJsonBtn.disabled = !hasResults;
    }
  }

  exportResults(format) {
    if (this.results.length === 0) {
      alert('No results to export');
      return;
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    if (format === 'csv') {
      this.exportCSV(timestamp);
    } else if (format === 'json') {
      this.exportJSON(timestamp);
    }
  }

  exportCSV(timestamp) {
    const headers = ['Domain', 'Monthly Visits', 'Status'];
    const csvContent = [
      headers.join(','),
      ...this.results.map(result => [
        `"${result.domain}"`,
        `"${typeof result.monthlyVisits === 'number' ? result.monthlyVisits : result.monthlyVisits}"`,
        `"${result.status}"`
      ].join(','))
    ].join('\n');
    
    this.downloadFile(csvContent, `traffic-analysis-${timestamp}.csv`, 'text/csv');
  }

  exportJSON(timestamp) {
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      totalDomains: this.results.length,
      results: this.results
    }, null, 2);
    
    this.downloadFile(jsonContent, `traffic-analysis-${timestamp}.json`, 'application/json');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  bindTableSorting() {
    const headers = document.querySelectorAll('#results-table th[data-sort]');
    
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        const isAscending = !header.classList.contains('sort-asc');
        
        // Remove sort classes from all headers
        headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        
        // Add sort class to current header
        header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
        
        // Sort results
        this.sortResults(sortKey, isAscending);
        this.populateTable();
      });
    });
  }

  sortResults(key, ascending) {
    this.results.sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      
      // Handle special sorting for numeric values
      if (key === 'monthlyVisits') {
        aVal = typeof aVal === 'number' ? aVal : (aVal === 'N/A' ? 0 : 0);
        bVal = typeof bVal === 'number' ? bVal : (bVal === 'N/A' ? 0 : 0);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TrafficChecker();
});