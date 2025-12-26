import React from "react";

type Category = "콘서트" | "뮤지컬" | "연극";

interface CategoryNavProps {
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  const categories: Category[] = ["콘서트", "뮤지컬", "연극"];

  return (
    <nav className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`py-4 px-2 font-medium text-base transition-colors relative ${
                selectedCategory === category
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {category}
              {selectedCategory === category && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default CategoryNav;
