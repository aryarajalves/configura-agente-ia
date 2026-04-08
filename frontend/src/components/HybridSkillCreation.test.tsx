import React from 'react';
import { render, screen } from '@testing-library/react';
import { HybridSkillCreation } from './HybridSkillCreation';

test('renders HybridSkillCreation text', () => {
  render(<HybridSkillCreation />);
  expect(screen.getByText('Create Hybrid Skill')).toBeInTheDocument();
});
