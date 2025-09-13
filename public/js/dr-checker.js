let currentResults = [];
let quotaManager = null;

// Initialize quota manager
if (typeof QuotaManager !== 'undefined') {
  quotaManager = new QuotaManager();
}

// Export button setup function - moved to global scope
function setupExportButton() {
  const csvBtn = document.getElementById('export-csv-btn');
  const jsonBtn = document.getElementById('export-json-btn');
  
  // Setup CSV export
  if (csvBtn && csvBtn.getAttribute('data-listener-added') !== 'true') {
    csvBtn.setAttribute('data-listener-added', 'true');
    csvBtn.addEventListener('click', function() {
      if (currentResults.length === 0) return;
      
      const csvRows = [['Domain', 'Domain Rating', 'Status']];
      for (let i = 0; i < currentResults.length; i++) {
        const result = currentResults[i];
        const statusText = result.status === 'success' ? 'Success' : 'Error';
        csvRows.push([result.domain, result.dr || 0, statusText]);
      }
      
      const csvContent = csvRows.map(function(row) {
        return row.join(',');
      }).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dr-check-results.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
  
  // Setup JSON export
  if (jsonBtn && jsonBtn.getAttribute('data-listener-added') !== 'true') {
    jsonBtn.setAttribute('data-listener-added', 'true');
    jsonBtn.addEventListener('click', function() {
      if (currentResults.length === 0) return;
      
      const exportData = {
        exportDate: new Date().toISOString(),
        totalDomains: currentResults.length,
        results: currentResults.map(function(result) {
          return {
            domain: result.domain,
            domainRating: result.dr || 0,
            status: result.status === 'success' ? 'Success' : 'Error'
          };
        })
      };
      
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dr-check-results.json';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const domainsInput = document.getElementById('domains');
  const checkBtn = document.getElementById('check-btn');
  const clearBtn = document.getElementById('clear-btn');

  const btnText = document.getElementById('check-btn-text');
  
  if (!domainsInput || !checkBtn || !clearBtn) {
    console.error('Required DOM elements not found');
    return;
  }
  
  domainsInput.addEventListener('domainCountChange', function(event) {
    const detail = event.detail;
    const count = detail.count;
    const isValid = detail.isValid;
    checkBtn.disabled = !(count > 0 && isValid);
  });
  
  clearBtn.addEventListener('click', function() {
    domainsInput.value = '';
    domainsInput.dispatchEvent(new Event('input'));
    
    if (window.ResultsTable) {
      window.ResultsTable.hide();
    }
    if (window.ProgressBar) {
      window.ProgressBar.reset();
    }
    
    checkBtn.disabled = true;
    currentResults = [];
  });
  
  checkBtn.addEventListener('click', async function() {
    const domains = domainsInput.value.trim().split('\n').filter(function(domain) {
      return domain.trim() !== '';
    });
    
    if (domains.length === 0 || domains.length > 100) {
      return;
    }
    
    // Check quota before proceeding
    if (quotaManager) {
      const canProceed = await quotaManager.executeWithQuotaCheck('dr_check', async function() {
        await performDRCheck(domains);
      });
      
      if (!canProceed) {
        return; // Quota check failed, stop execution
      }
    } else {
      // Fallback if quota manager is not available
      await performDRCheck(domains);
    }
  });
  
  async function performDRCheck(domains) {
    if (btnText) btnText.textContent = 'Checking...';
    
    if (window.ProgressBar) {
      window.ProgressBar.show();
    }
    if (window.ResultsTable) {
      window.ResultsTable.hide();
    }
    
    currentResults = [];
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i].trim();
      const progress = ((i + 1) / domains.length) * 100;
      
      if (window.ProgressBar) {
        window.ProgressBar.update(progress);
      }
      
      await new Promise(function(resolve) {
        setTimeout(resolve, 200);
      });
      
      try {
        // Call the server-side API
        const response = await fetch('/api/dr-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ domains: [domain] })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        const result = data.results[0] || {
           domain: domain,
           dr: 0,
           status: 'error'
         };
         
         // Ensure the result has the correct format
         result.status = result.status === 'success' ? 'success' : 'error';
        
        currentResults.push(result);
      } catch (error) {
        console.error('API Error:', error);
        const errorResult = {
           domain: domain,
           dr: 0,
           status: 'error',
           error: error.message
         };
        currentResults.push(errorResult);
      }
    }
    
    if (btnText) btnText.textContent = 'Check Domain Ratings';
    if (window.ProgressBar) {
      window.ProgressBar.hide();
    }
    
    checkBtn.disabled = false;
    
    displayResults(currentResults);
  }
  
  // Export button event listener will be added after table is shown
  
  document.addEventListener('tableSortChange', function(event) {
    const detail = event.detail;
    const sortBy = detail.sortBy;
    const isAscending = detail.isAscending;
    
    currentResults.sort(function(a, b) {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (isAscending) {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    displayResults(currentResults);
  });
});

function displayResults(results) {
  if (!window.ResultsTable) {
    console.error('ResultsTable utility not found');
    return;
  }
  
  const tableData = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const statusText = result.status === 'success' ? 'Success' : 'Error';
    const statusClass = result.status === 'success' ? 'text-green-600' : 'text-red-600';
    
    // Convert to HTML string format that ResultsTable expects
    const rowHtml = `
      <td class="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">${result.domain}</td>
      <td class="px-6 py-4 whitespace-nowrap text-base text-gray-500">${result.dr || 0}</td>
      <td class="px-6 py-4 whitespace-nowrap text-base ${statusClass}">${statusText}</td>
    `;
    
    tableData.push(rowHtml);
  }
  
  window.ResultsTable.setData(tableData);
  
  // Setup export button after table is shown
  setTimeout(setupExportButton, 100);
  
  // Scroll to results title section smoothly with navbar offset
    setTimeout(() => {
      // First try to find the results container h2 title
      const resultsContainer = document.querySelector('#results-container');
      let resultsTitle = null;
      
      if (resultsContainer) {
        resultsTitle = resultsContainer.querySelector('h2');
      }
      
      if (resultsTitle) {
        // Calculate navbar height (typically around 64px)
        const navbar = document.querySelector('nav, .navbar, header');
        const navbarHeight = navbar ? navbar.offsetHeight : 80;
        
        // Get the position of results title
        const rect = resultsTitle.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop - navbarHeight - 40; // 40px extra padding to show title better
        
        // Smooth scroll to the calculated position
        window.scrollTo({
          top: Math.max(0, targetPosition),
          behavior: 'smooth'
        });
      } else if (resultsContainer) {
        // Fallback: scroll to results container if title not found
        const navbar = document.querySelector('nav, .navbar, header');
        const navbarHeight = navbar ? navbar.offsetHeight : 80;
        const rect = resultsContainer.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetPosition = rect.top + scrollTop - navbarHeight - 20;
        
        window.scrollTo({
          top: Math.max(0, targetPosition),
          behavior: 'smooth'
        });
      }
    }, 200);
}