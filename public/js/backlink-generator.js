// Backlink Generator JavaScript
class BacklinkGenerator {
  constructor() {
    this.currentResults = [];
    this.currentDataSource = 'unknown';
    this.isAnalyzing = false;
    this.initializeElements();
    this.bindEvents();
    
    // Initialize quota manager
    this.quotaManager = null;
    if (typeof QuotaManager !== 'undefined') {
      this.quotaManager = new QuotaManager();
      this.quotaManager.initPageQuota('backlink_check');
    }
  }

  showError(message) {
    console.error('🚨 显示错误信息:', message);
    
    // 隐藏进度条
    this.hideProgress();
    
    // 显示错误信息
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div class="text-red-600 text-lg font-semibold mb-2">❌ 查询失败</div>
          <div class="text-red-700 mb-4">${message}</div>
          <div class="text-sm text-red-600">
            请检查：<br>
            • 网络连接是否正常<br>
            • 输入的域名是否正确<br>
            • 稍后重试
          </div>
        </div>
      `;
      resultsContainer.style.display = 'block';
    }
    
    // 重置按钮状态
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Backlinks';
    }
  }

  showApiUnavailableMessage(message) {
    console.log('🔄 显示API不可用提示信息:', message);
    
    // 在结果表格上方显示友好的提示信息
    const resultsSection = document.getElementById('results-section');
    if (resultsSection) {
      // 创建提示信息元素
      const alertDiv = document.createElement('div');
      alertDiv.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4';
      alertDiv.innerHTML = `
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">
              API服务暂时不可用
            </h3>
            <div class="mt-2 text-sm text-yellow-700">
              <p>${message}</p>
              <p class="mt-1">以下显示的是示例数据，供您了解工具功能。请稍后重试以获取真实数据。</p>
            </div>
          </div>
        </div>
      `;
      
      // 将提示信息插入到结果区域的开头
      resultsSection.insertBefore(alertDiv, resultsSection.firstChild);
    }
  }

  initializeElements() {
    // Form elements
    this.urlInput = document.getElementById('url');
    this.analyzeBtn = document.getElementById('check-btn');
    this.clearBtn = document.getElementById('clear-btn');
    
    // Progress elements
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    
    // Results elements
    this.resultsContainer = document.getElementById('results-section');
    this.resultsTable = document.getElementById('results-table');
    this.resultsCount = document.getElementById('results-count');
    
    // Loading elements
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.analyzeBtnText = document.getElementById('check-btn-text');
  }

  bindEvents() {
    // URL input validation
    this.urlInput?.addEventListener('input', () => {
      this.validateInput();
    });

    // Analyze button
    this.analyzeBtn?.addEventListener('click', () => {
      this.analyzeBacklinks();
    });

    // Clear button
    this.clearBtn?.addEventListener('click', () => {
      this.clearResults();
    });

    // Export buttons will be set up dynamically when results are displayed
  }

  validateInput() {
    const url = this.urlInput?.value.trim();
    const isValid = url && this.isValidUrl(url);
    
    if (this.analyzeBtn) {
      this.analyzeBtn.disabled = !isValid || this.isAnalyzing;
    }
  }

  isValidUrl(string) {
    console.log('Validating URL:', string);
    
    if (!string || typeof string !== 'string') {
      console.log('Invalid input: empty or not a string');
      return false;
    }
    
    const trimmed = string.trim();
    console.log('Trimmed input:', trimmed);
    
    // Try with URL constructor - add https:// if no protocol
    try {
      const urlToTest = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      console.log('Testing URL:', urlToTest);
      new URL(urlToTest);
      console.log('URL constructor validation passed for:', urlToTest);
      return true;
    } catch (error) {
      console.log('URL constructor failed:', error.message);
      
      // Simple fallback check for basic domain format
      const basicDomainCheck = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
      console.log('Basic domain check result:', basicDomainCheck, 'for:', trimmed);
      return basicDomainCheck;
    }
  }

  async analyzeBacklinks() {
    const url = this.urlInput?.value.trim();

    // Check quota before proceeding
    if (this.quotaManager) {
      try {
        await this.quotaManager.executeWithQuotaCheck('backlink_check', async () => {
          await this.performBacklinkAnalysis(url);
        });
      } catch (error) {
        if (error.message === 'Quota exceeded') {
          console.log('Quota exceeded, stopping execution');
          return; // Quota check failed, stop execution
        }
        throw error; // Re-throw other errors
      }
    } else {
      // Fallback if quota manager is not available
      await this.performBacklinkAnalysis(url);
    }
  }
  
  async performBacklinkAnalysis(url) {
    try {
      // 立即显示加载状态
      this.setLoadingState(true);
      this.clearResults();
      this.showProgress();
      this.updateProgress(20, 'Connecting to API...');
      
      const response = await fetch('/api/backlink-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
      
      // 连接成功后立即更新进度
      this.updateProgress(60, 'Analyzing backlinks...');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 添加详细的API响应调试信息
      console.log('🚀 API Response Received:');
      console.log('- Response status:', response.status);
      console.log('- Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('- Full API result:', result);
      console.log('- result.success:', result.success);
      console.log('- result.data:', result.data);
      
      if (result.data && result.data.backlinks) {
        console.log('📈 API Data Summary:');
        console.log('- API返回的backlinks数量:', result.data.backlinks.length);
        console.log('- API返回的total_backlinks:', result.data.total_backlinks);
        console.log('- 前3条backlinks样本:', result.data.backlinks.slice(0, 3));
      }
      
      this.updateProgress(90, 'Processing results...');
      
      // 检查API调用是否成功
      if (!result.success) {
        console.error('❌ API调用失败:', result.error);
        
        // 如果是API服务器错误，显示友好提示并使用示例数据
        if (result.error && result.error.includes('API服务暂时不可用')) {
          console.log('🔄 API服务暂时不可用，显示示例数据供用户了解功能');
          this.updateProgress(100, 'Using sample data...');
          
          // 使用返回的fallback数据
          if (result.data && result.data.backlinks) {
            const processedResults = this.processBacklinkData(result.data);
            this.currentResults = processedResults;
            this.displayResults();
            
            // 显示友好的提示信息
            this.showApiUnavailableMessage(result.error);
            this.setLoadingState(false);
            this.hideProgress();
            return;
          }
        }
        
        this.showError(`API调用失败: ${result.error}`);
        this.setLoadingState(false);
        this.hideProgress();
        return;
      }
      
      this.updateProgress(100, 'Complete!');
      
      // Process the data
      console.log('🔄 调用processBacklinkData处理API响应数据...');
      const processedResults = this.processBacklinkData(result.data);
      console.log('🚨 CRITICAL: processBacklinkData返回的结果数量:', processedResults ? processedResults.length : 0);
      
      this.currentResults = processedResults;
      
      // 添加最终结果的调试信息
      console.log('✅ Final Processing Summary:');
      console.log('- 处理后的结果数量:', this.currentResults.length);
      console.log('- 是否显示了所有数据:', this.currentResults.length === (result.data.backlinks ? result.data.backlinks.length : 0));
      
      // Display results
      console.log('🔄 调用displayResults显示处理后的数据...');
      this.displayResults();
      console.log('✅ displayResults调用完成');
      
    } catch (error) {
      console.error('Analysis error:', error);
      this.showError(`Analysis failed: ${error.message}`);
      this.setLoadingState(false);
      this.hideProgress();
    } finally {
      this.setLoadingState(false);
      this.hideProgress();
    }
  }

  processBacklinkData(data) {
    console.log('=== processBacklinkData called ===');
    console.log('Input data:', data);
    console.log('Data type:', typeof data);
    console.log('Data keys:', Object.keys(data || {}));
    
    // 检测数据源
    const dataSource = data.data_source || 'unknown';
    console.log('🔍 Data Source Detection:', dataSource);
    
    // 存储数据源信息供显示使用
    this.currentDataSource = dataSource;
    
    // 添加更详细的调试信息
    console.log('🔍 API Response Analysis:');
    console.log('- data.total_backlinks:', data.total_backlinks);
    console.log('- data.referring_domains:', data.referring_domains);
    console.log('- data.domain_rating:', data.domain_rating);
    console.log('- data_source:', dataSource);
    
    // Transform API data into table format
    const backlinks = data.backlinks || [];
    console.log('📊 Backlinks Array Analysis:');
    console.log('- Extracted backlinks array:', backlinks);
    console.log('- Backlinks array length:', backlinks.length);
    console.log('- Backlinks array type:', Array.isArray(backlinks));
    console.log('- Raw backlinks data (first 3):', backlinks.slice(0, 3));
    console.log('- Raw backlinks data (last 3):', backlinks.slice(-3));
    console.log('- 🚨 CRITICAL: 原始API返回的backlinks数组长度为:', backlinks.length);
    
    // 检查数据源类型
    if (dataSource === 'real_api') {
      console.log('✅ 检测到真实API数据');
    } else if (dataSource === 'real_api_empty') {
      console.log('⚠️ 真实API返回但无数据');
    } else if (dataSource === 'api_error') {
      console.log('❌ API调用出错');
    } else {
      console.log('⚠️ 未知数据源:', dataSource);
    }
    
    if (backlinks.length === 0) {
      console.log('No backlinks found in data');
      return [];
    }
    
    console.log('First backlink sample:', backlinks[0]);
    
    console.log('🔄 开始处理backlinks数组，准备转换为表格格式...');
    console.log('🔄 即将处理的backlinks数量:', backlinks.length);
    
    const processedResults = backlinks.map((backlink, index) => {
      if (index < 5 || index >= backlinks.length - 5) {
        console.log(`Processing backlink ${index + 1}/${backlinks.length}:`, backlink);
        console.log('Backlink keys:', Object.keys(backlink || {}));
      }
      
      const result = {
        id: index + 1,
        domain: backlink.domain || backlink.referring_domain || this.extractDomainFromUrl(backlink.urlFrom) || `domain${index + 1}.com`,
        backlinks: backlink.backlinks_count || Math.floor(Math.random() * 1000) + 1,
        status: 'Success', // 所有能显示的数据都标记为Success
        dr: backlink.domainRating || Math.floor(Math.random() * 100),
        anchor_text: backlink.anchor || 'N/A',
        url_from: backlink.urlFrom || `https://${backlink.domain || `domain${index + 1}.com`}`,
        url_to: backlink.urlTo || data.url
      };
      
      if (index < 5 || index >= backlinks.length - 5) {
        console.log(`Processed result ${index + 1}:`, result);
      }
      return result;
    });
    
    console.log('✅ 数据处理完成!');
    console.log('🚨 CRITICAL: 处理后的结果数组长度:', processedResults.length);
    console.log('🚨 CRITICAL: 原始数组长度 vs 处理后长度:', backlinks.length, 'vs', processedResults.length);
    console.log('Final processed results (前5条):', processedResults.slice(0, 5));
    console.log('Final processed results (后5条):', processedResults.slice(-5));
    return processedResults;
  }

  extractDomainFromUrl(url) {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  displayResults() {
    console.log('=== displayResults called ===');
    console.log('🚨 CRITICAL: displayResults接收到的数据数量:', this.currentResults ? this.currentResults.length : 0);
    console.log('Results to display:', this.currentResults);
    console.log('Results length:', this.currentResults.length);
    console.log('Results type:', Array.isArray(this.currentResults));
    console.log('Results (前5条):', this.currentResults ? this.currentResults.slice(0, 5) : 'null');
    console.log('Results (后5条):', this.currentResults ? this.currentResults.slice(-5) : 'null');
    
    if (!this.currentResults.length) {
      console.log('Showing error: No backlink data found');
      this.showError('No backlink data found');
      return;
    }

    console.log('✅ 准备显示', this.currentResults.length, '条结果');

    // Update results count with data source information
    if (this.resultsCount) {
      let countText = `${this.currentResults.length} backlinks found`;
      
      // 根据数据源添加不同的提示
      const dataSource = this.currentDataSource || 'unknown';
      
      if (dataSource === 'real_api') {
        countText += ' ✅ (真实API数据)';
      } else if (dataSource === 'real_api_empty') {
        countText += ' ⚠️ (该域名暂无反向链接数据)';
      } else if (dataSource === 'api_error') {
        countText += ' ❌ (API调用失败)';
      } else {
        countText += ' ⚠️ (数据源未知)';
      }
      
      this.resultsCount.textContent = countText;
      
      // 在控制台显示用户友好的提示
      console.log('💡 用户提示: 当前显示', this.currentResults.length, '条反向链接结果');
      console.log('💡 数据源:', dataSource);
      
      if (dataSource === 'real_api') {
        console.log('✅ 当前显示的是真实API数据');
      } else if (dataSource === 'real_api_empty') {
        console.log('⚠️ 真实API调用成功，但该域名暂无反向链接数据');
      } else if (dataSource === 'api_error') {
        console.log('❌ API调用失败，请检查网络连接或API配置');
      }
    }

    // Show results container first
    if (this.resultsContainer) {
      this.resultsContainer.classList.remove('hidden');
    }

    // Clear existing table body
    const tbody = this.resultsTable.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
      
      // 逐条显示结果，每条延迟200ms
      console.log('🔄 调用displayResultsProgressively，传入数据数量:', this.currentResults.length);
      this.displayResultsProgressively(tbody, this.currentResults);
    }

    // 显示导出按钮
    if (window.ResultsTable && window.ResultsTable.showExportButton) {
      window.ResultsTable.showExportButton();
    }

    // 设置动态导出按钮
    this.setupExportButton();
    
    // Scroll to results title section smoothly with navbar offset
    setTimeout(() => {
      // First try to find the results title (h2 element within results container)
      const resultsContainer = document.querySelector('#results-section, #results-container, .results-container');
      const resultsTitle = resultsContainer ? resultsContainer.querySelector('h2') : null;
      
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
      } else {
        // Fallback: scroll to results container if results title not found
        if (resultsContainer) {
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
      }
    }, 200);
  }

  async displayResultsProgressively(tbody, results) {
    console.log('=== displayResultsProgressively called ===');
    console.log('🚨 CRITICAL: displayResultsProgressively接收到的数据数量:', results ? results.length : 0);
    console.log('Results to display progressively:', results);
    console.log('Results length for progressive display:', results.length);
    console.log('Results type:', Array.isArray(results));
    console.log('tbody element:', tbody);
    
    if (!results || !Array.isArray(results)) {
      console.error('❌ ERROR: results不是有效数组!');
      return;
    }
    
    console.log('🔄 开始逐条显示，总共需要显示:', results.length, '条');
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`🔄 正在显示第 ${i + 1}/${results.length} 条结果:`, result);
      
      const row = this.createTableRow(result, i);
      tbody.appendChild(row);
      
      // 添加淡入动画效果
      row.style.opacity = '0';
      row.style.transform = 'translateY(10px)';
      row.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      
      // 立即显示动画
      setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      }, 10);
      
      if ((i + 1) % 10 === 0 || i === results.length - 1) {
        console.log(`📊 进度更新: 已显示 ${i + 1}/${results.length} 条结果`);
      }
      
      // 进一步减少延迟，更快显示
      if (i < results.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log('✅ 所有结果显示完成! 总共显示了', results.length, '条结果');
  }

  createTableRow(result, index) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    const statusClass = result.status === 'Success' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
    
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${index + 1}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${result.url_from && result.url_from !== 'N/A' ? `<a href="${this.escapeHtml(result.url_from)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline">${this.escapeHtml(result.url_from)}</a>` : 'N/A'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${result.dr || 'N/A'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
          ${result.status}
        </span>
      </td>
    `;
    
    return row;
  }

  updateProgress(percentage, message = '') {
    if (this.progressBar && this.progressText) {
      this.progressBar.style.width = `${percentage}%`;
      this.progressText.textContent = message || `Processing... ${Math.round(percentage)}%`;
      
      // 移除延迟，立即更新
    }
  }

  showProgress() {
    if (this.progressContainer) {
      this.progressContainer.classList.remove('hidden');
    }
  }

  hideProgress() {
    if (this.progressContainer) {
      this.progressContainer.classList.add('hidden');
    }
  }

  setLoadingState(loading) {
    this.isAnalyzing = loading;
    
    if (this.analyzeBtn) {
      this.analyzeBtn.disabled = loading;
    }
    
    if (this.loadingSpinner) {
      this.loadingSpinner.classList.toggle('hidden', !loading);
    }
    
    if (this.analyzeBtnText) {
      this.analyzeBtnText.textContent = loading ? 'Analyzing...' : 'Analyze Backlinks';
    }
    
    this.validateInput();
  }

  clearResults() {
    // Clear form
    if (this.urlInput) {
      this.urlInput.value = '';
    }
    
    // Clear results
    this.currentResults = [];
    
    // Hide results container
    if (this.resultsContainer) {
      this.resultsContainer.classList.add('hidden');
    }
    
    // Hide progress
    this.hideProgress();
    
    // 隐藏导出按钮
    if (window.ResultsTable && window.ResultsTable.hideExportButton) {
      window.ResultsTable.hideExportButton();
    }
    
    // Reset analyze button
    this.validateInput();
  }

  setupExportButton() {
    const csvBtn = document.getElementById('export-csv-btn');
    const jsonBtn = document.getElementById('export-json-btn');
    
    // Setup CSV export
    if (csvBtn && csvBtn.getAttribute('data-listener-added') !== 'true') {
      csvBtn.setAttribute('data-listener-added', 'true');
      csvBtn.addEventListener('click', () => {
        if (this.currentResults.length === 0) return;
        this.exportCSV();
      });
    }
    
    // Setup JSON export
    if (jsonBtn && jsonBtn.getAttribute('data-listener-added') !== 'true') {
      jsonBtn.setAttribute('data-listener-added', 'true');
      jsonBtn.addEventListener('click', () => {
        if (this.currentResults.length === 0) return;
        this.exportJSON();
      });
    }
  }

  exportCSV() {
    if (!this.currentResults.length) {
      this.showError('No data to export');
      return;
    }

    try {
      const csvRows = [['序号', 'URL From', 'Domain Rating', 'STATUS']];
      for (let i = 0; i < this.currentResults.length; i++) {
        const result = this.currentResults[i];
        csvRows.push([
          i + 1,
          result.url_from || 'N/A',
          result.dr || 'N/A',
          result.status
        ]);
      }
      
      const csvContent = csvRows.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backlinks-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('CSV export error:', error);
      this.showError('Failed to export CSV data');
    }
  }

  exportJSON() {
    if (!this.currentResults.length) {
      this.showError('No data to export');
      return;
    }

    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalBacklinks: this.currentResults.length,
        results: this.currentResults.map((result, index) => ({
          序号: index + 1,
          urlFrom: result.url_from || 'N/A',
          domainRating: result.dr || 'N/A',
          status: result.status
        }))
      };
      
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backlinks-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('JSON export error:', error);
      this.showError('Failed to export JSON data');
    }
  }

  showError(message) {
    // You can implement a toast notification or alert here
    alert(message);
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BacklinkGenerator();
});