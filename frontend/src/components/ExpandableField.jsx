import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const ExpandableField = ({ label, value, onChange, type = 'text', placeholder, style = {}, showExpand = true }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Lock body scroll when expanded
    React.useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isExpanded]);

    const modalContent = (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(2, 6, 23, 0.95)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            backdropFilter: 'blur(10px)',
            boxSizing: 'border-box',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '1000px',
                height: '80vh',
                backgroundColor: '#0b1120',
                padding: '2rem',
                borderRadius: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <span className="section-label">Editando Campo</span>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800 }}>{label}</h3>
                    </div>
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="save-button"
                        style={{ width: 'auto', padding: '0.75rem 2rem' }}
                    >
                        Pronto
                    </button>
                </div>
                <textarea
                    value={value}
                    onChange={onChange}
                    style={{
                        flex: 1,
                        width: '100%',
                        backgroundColor: '#020617',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        fontSize: '1.1rem',
                        fontFamily: type === 'json' || type === 'textarea' ? 'JetBrains Mono, monospace' : 'inherit',
                        resize: 'none',
                        boxSizing: 'border-box',
                        lineHeight: '1.6',
                        outline: 'none'
                    }}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );

    return (
        <div className="expandable-field-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {label}
                </label>
            </div>

            <div style={{ position: 'relative' }}>
                {type === 'textarea' || type === 'json' ? (
                    <textarea
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className={type === 'json' || type === 'textarea' ? 'monospace' : ''}
                        style={{ ...style, minHeight: '100px', resize: 'vertical', paddingRight: '3.5rem', color: '#fff', background: '#0f172a' }}
                    />
                ) : (
                    <input
                        type={type}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className={type === 'json' ? 'monospace' : ''}
                        style={{ ...style, paddingRight: '3.5rem', color: '#fff', background: '#0f172a' }}
                    />
                )}

                {showExpand && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="maximize-btn"
                        title="Expandir para tela cheia"
                        type="button"
                    >
                        ⤢
                    </button>
                )}
            </div>

            {isExpanded && createPortal(modalContent, document.body)}
        </div>
    );
};

export default ExpandableField;
