import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { API_BASE_URL } from '../services/api';

// SocketIO URL
const SOCKET_URL = API_BASE_URL.replace('/api', '');

const Statistics = () => {
  const language = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const t = {
    zh: {
      title: '数据统计',
      totalFiles: '总处理文件',
      totalLabel: '文件总数',
      todayLabel: '今日处理',
      weekLabel: '本周处理',
      programBreakdown: '各程序统计',
      files: '个文件',
      recentActivity: '近期活动',
      noActivity: '暂无活动记录',
      loading: '加载中...',
      programs: {
        ai_rename: 'AI 重命名',
        video_split: '视频分割',
        add_intro: '添加片头',
        subtitles: '字幕整理',
        compress: '视频压缩',
        course: '课程文案',
      },
    },
    en: {
      title: 'Statistics',
      totalFiles: 'Total Processed',
      totalLabel: 'Total Files',
      todayLabel: 'Today',
      weekLabel: 'This Week',
      programBreakdown: 'By Program',
      files: 'files',
      recentActivity: 'Recent Activity',
      noActivity: 'No activity records',
      loading: 'Loading...',
      programs: {
        ai_rename: 'AI Rename',
        video_split: 'Video Split',
        add_intro: 'Add Intro',
        subtitles: 'Subtitles',
        compress: 'Compression',
        course: 'Course Copy',
      },
    },
  }[language];

  // 初始加载和 SocketIO 实时更新
  useEffect(() => {
    fetchStatistics();

    // 动态加载 socket.io-client
    const loadSocketIO = async () => {
      try {
        const { io } = await import('socket.io-client');
        socketRef.current = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
        });

        socketRef.current.on('connect', () => {
          console.log('Statistics: SocketIO 已连接');
        });

        // 监听实时统计更新
        socketRef.current.on('statistics_update', (data) => {
          if (data.success && data.data) {
            setStats(data.data);
          }
        });
      } catch (err) {
        console.log('SocketIO 加载失败，使用轮询模式');
      }
    };

    loadSocketIO();

    // 备用：每 10 秒轮询一次（作为 SocketIO 的备份）
    const interval = setInterval(fetchStatistics, 10000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // 当页面重新可见时刷新（用户从其他页面切回来）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStatistics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/statistics`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        // 如果 API 失败，使用默认值
        setStats({
          total: 0,
          today: 0,
          week: 0,
          programs: [
            { key: 'ai_rename', count: 0, today: 0 },
            { key: 'video_split', count: 0, today: 0 },
            { key: 'add_intro', count: 0, today: 0 },
            { key: 'subtitles', count: 0, today: 0 },
            { key: 'compress', count: 0, today: 0 },
            { key: 'course', count: 0, today: 0 },
          ],
          recentActivity: [],
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      // 使用默认值
      setStats({
        total: 0,
        today: 0,
        week: 0,
        programs: [
          { key: 'ai_rename', count: 0, today: 0 },
          { key: 'video_split', count: 0, today: 0 },
          { key: 'add_intro', count: 0, today: 0 },
          { key: 'subtitles', count: 0, today: 0 },
          { key: 'compress', count: 0, today: 0 },
          { key: 'course', count: 0, today: 0 },
        ],
        recentActivity: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // 确保数据完整性
  const safeStats = {
    total: stats?.total ?? 0,
    today: stats?.today ?? 0,
    week: stats?.week ?? 0,
    programs: stats?.programs || [
      { key: 'ai_rename', count: 0, today: 0 },
      { key: 'video_split', count: 0, today: 0 },
      { key: 'add_intro', count: 0, today: 0 },
      { key: 'subtitles', count: 0, today: 0 },
      { key: 'compress', count: 0, today: 0 },
      { key: 'course', count: 0, today: 0 },
    ],
    recentActivity: stats?.recentActivity || [],
  };

  const maxCount = Math.max(...safeStats.programs.map((p) => p.count), 1);

  return (
    <>
      <Sidebar />

      {/* 左侧主面板 */}
      <main className="panel panel-main">
        <h2 className="section-header">
          07 — <span>{t.title}</span>
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            {t.loading}
          </div>
        ) : (
          <>
            {/* 总览卡片 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-lg)',
                marginBottom: 'var(--space-xl)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '40px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {safeStats.total.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--fg-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: '4px',
                  }}
                >
                  {t.totalLabel}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '40px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {safeStats.today}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--fg-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: '4px',
                  }}
                >
                  {t.todayLabel}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '40px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {safeStats.week}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--fg-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: '4px',
                  }}
                >
                  {t.weekLabel}
                </div>
              </div>
            </div>

            {/* 各程序统计 - 水平条形图 */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: 'var(--space-lg)',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  marginBottom: 'var(--space-lg)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {t.programBreakdown}
              </h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-md)',
                }}
              >
                {safeStats.programs.map((program) => (
                  <div key={program.key}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                        }}
                      >
                        {t.programs[program.key]}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13px',
                          color: 'var(--fg-secondary)',
                        }}
                      >
                        {program.count} {t.files}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        background: 'rgba(0,0,0,0.06)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(program.count / maxCount) * 100}%`,
                          background: 'var(--fg-primary)',
                          borderRadius: '10px',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 右侧活动面板 */}
      <aside className="panel panel-files">
        <h3 className="section-header" style={{ fontSize: '20px' }}>
          {t.recentActivity}
        </h3>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--fg-muted)' }}>
              {t.loading}
            </div>
          ) : safeStats.recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--fg-muted)' }}>
              {t.noActivity}
            </div>
          ) : (
            safeStats.recentActivity.map((activity, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      marginBottom: '2px',
                    }}
                  >
                    {t.programs[activity.program]}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--fg-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {activity.time}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '18px',
                  }}
                >
                  +{activity.count}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};

export default Statistics;
