import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProductDetailPage from "../ProductDetailPage";
import * as api from "../../../api/api";

vi.mock("../../../api/api", () => ({
  fetchClaudeAnalysis: vi.fn(),
  fetchSavedRecommendations: vi.fn(),
  runAnalysis: vi.fn(),
  generateRecommendations: vi.fn(),
  fetchJobDetails: vi.fn(),
}));

vi.mock("../../../context/NotificationContext", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

vi.mock("../../../components/PageHeader/PageHeader", () => ({
  default: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}));

vi.mock("../../analysisPage/AnalysisPage", () => ({
  default: ({ productData, embedded, onRegenerate, isRegenerating }) => (
    <div data-testid={embedded ? "analysis-embedded" : "analysis-page"}>
      {productData?.common_pain_points?.length ? (
        <span>{productData.common_pain_points.length} pain points</span>
      ) : (
        <span>No pain points</span>
      )}
      {embedded && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          aria-label={isRegenerating ? "Regenerating…" : "Regenerate"}
        >
          {isRegenerating ? "Regenerating…" : "Regenerate"}
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../recommendationPage/RecomendationPage", () => ({
  default: ({ productData, embedded, onRegenerate }) => (
    <div data-testid="recommendations-page" data-recommendation-type={productData?.recommendation_type} data-summary={productData?.summary}>
      Recommendations
      {productData?.summary && <span data-testid="rec-summary">{productData.summary}</span>}
      {embedded && onRegenerate && (
        <button type="button" onClick={onRegenerate}>
          Regenerate
        </button>
      )}
    </div>
  ),
}));

function renderWithRouter(productName = "Hubspot") {
  return render(
    <MemoryRouter initialEntries={[`/products/${encodeURIComponent(productName)}`]}>
      <Routes>
        <Route path="/products/:productName" element={<ProductDetailPage />} />
        <Route path="/results" element={<div data-testid="results-page">Results</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [], recommendations: [] });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });
    api.fetchJobDetails.mockResolvedValue({
      job: {
        _id: "job-123",
        status: "in_progress",
        parameters: { type: "analysis", product: "Hubspot" },
        created_at: new Date().toISOString(),
      },
    });
  });

  it("shows product name and single Back to Results button", async () => {
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [] });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
    });

    const backButtons = screen.getAllByRole("button", { name: /back to results/i });
    expect(backButtons.length).toBe(1);
  });

  it("navigates to results when Back to Results is clicked", async () => {
    const user = userEvent.setup();
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [] });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back to results/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /back to results/i }));

    await waitFor(() => {
      expect(screen.getByTestId("results-page")).toBeInTheDocument();
    });
  });

  it("shows Run Analysis when no analysis", async () => {
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [] });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("TestProduct");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run analysis/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/no analysis available/i)).toBeInTheDocument();
  });

  it("normalizes and shows analysis with pain points when API returns nested analysis", async () => {
    api.fetchClaudeAnalysis.mockResolvedValue({
      analyses: [
        {
          _id: "hubspot",
          product: "hubspot",
          analysis: {
            common_pain_points: [
              { name: "Pain 1", description: "D1", severity: "high" },
              { name: "Pain 2", description: "D2", severity: "medium" },
            ],
            analysis_summary: "Summary text",
          },
        },
      ],
    });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByTestId("analysis-embedded")).toBeInTheDocument();
    });

    expect(screen.getByText(/2 pain points/i)).toBeInTheDocument();
  });

  it("shows Regenerate button when analysis exists", async () => {
    api.fetchClaudeAnalysis.mockResolvedValue({
      analyses: [
        {
          _id: "hubspot",
          product: "hubspot",
          analysis: {
            common_pain_points: [{ name: "P1", description: "D1", severity: "high" }],
            analysis_summary: "Summary",
          },
        },
      ],
    });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByTestId("analysis-embedded")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
  });

  it("Oracle 1: shows confirmation modal when Regenerate is clicked", async () => {
    const user = userEvent.setup();
    api.fetchClaudeAnalysis.mockResolvedValue({
      analyses: [
        {
          _id: "hubspot",
          product: "hubspot",
          analysis: {
            common_pain_points: [{ name: "P1" }],
            analysis_summary: "S",
          },
        },
      ],
    });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /regenerate/i }));

    await waitFor(() => {
      expect(screen.getByText(/regenerate analysis\?/i)).toBeInTheDocument();
      expect(screen.getByText(/1 credit/i)).toBeInTheDocument();
      expect(screen.getByText(/clear the current analysis/i)).toBeInTheDocument();
    });
  });

  it("calls runAnalysis with regenerate: true when modal Regenerate is confirmed", async () => {
    const user = userEvent.setup();
    api.fetchClaudeAnalysis.mockResolvedValue({
      analyses: [
        {
          _id: "hubspot",
          product: "hubspot",
          analysis: {
            common_pain_points: [{ name: "P1" }],
            analysis_summary: "S",
          },
        },
      ],
    });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });
    api.runAnalysis.mockResolvedValue({ status: "success", job_id: "123" });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /regenerate/i }));

    await waitFor(() => {
      expect(screen.getByText(/regenerate analysis\?/i)).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: /^regenerate$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(api.runAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          product: "Hubspot",
          max_posts: expect.any(Number),
          skip_recommendations: expect.any(Boolean),
          regenerate: true,
        })
      );
    });
  });

  it("calls fetchSavedRecommendations with correct recommendation_type when switching recommendation type tabs", async () => {
    const user = userEvent.setup();
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [] });
    api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
    });

    // Switch to Recommendations tab
    await user.click(screen.getByRole("button", { name: /recommendations/i }));

    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: /recommendation type/i })).toBeInTheDocument();
    });

    // Default tab is "Improve the product" – fetchSavedRecommendations should have been called with improve_product (on load)
    expect(api.fetchSavedRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ["Hubspot"],
        recommendationType: "improve_product",
      })
    );

    // Switch to "Create a new feature" – should fetch with new_feature
    await user.click(screen.getByRole("tab", { name: /create a new feature/i }));

    await waitFor(() => {
      expect(api.fetchSavedRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          products: ["Hubspot"],
          recommendationType: "new_feature",
        })
      );
    });

    // Switch to "Create a competing product" – should fetch with competing_product
    await user.click(screen.getByRole("tab", { name: /create a competing product/i }));

    await waitFor(() => {
      expect(api.fetchSavedRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          products: ["Hubspot"],
          recommendationType: "competing_product",
        })
      );
    });
  });

  describe("recommendations generate and regenerate with optional text", () => {
    const analysisWithPainPoints = {
      analyses: [
        {
          _id: "hubspot",
          product: "hubspot",
          analysis: {
            common_pain_points: [{ name: "P1", description: "D1", severity: "high" }],
            analysis_summary: "Summary",
          },
        },
      ],
    };

    it("calls generateRecommendations without context when generating first time with no optional text", async () => {
      const user = userEvent.setup();
      api.fetchClaudeAnalysis.mockResolvedValue(analysisWithPainPoints);
      api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });
      api.generateRecommendations.mockResolvedValue({ status: "success", job_id: "job-1" });

      renderWithRouter("Hubspot");

      await waitFor(() => {
        expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
      });

      await user.click(screen.getByRole("button", { name: /recommendations/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate recommendations \(2 credits\)/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /generate recommendations \(2 credits\)/i }));

      await waitFor(() => {
        expect(api.generateRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            products: ["Hubspot"],
            recommendationType: "improve_product",
            regenerate: false,
          })
        );
        const call = api.generateRecommendations.mock.calls[0][0];
        expect(call.context).toBeUndefined();
      });
    });

    it("calls generateRecommendations with context when user fills optional direction and generates first time", async () => {
      const user = userEvent.setup();
      api.fetchClaudeAnalysis.mockResolvedValue(analysisWithPainPoints);
      api.fetchSavedRecommendations.mockResolvedValue({ recommendations: [] });
      api.generateRecommendations.mockResolvedValue({ status: "success", job_id: "job-1" });

      renderWithRouter("Hubspot");

      await waitFor(() => {
        expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
      });

      await user.click(screen.getByRole("button", { name: /recommendations/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/optional direction/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/optional direction/i), "Focus on mobile");
      await user.click(screen.getByRole("button", { name: /generate recommendations \(2 credits\)/i }));

      await waitFor(() => {
        expect(api.generateRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            products: ["Hubspot"],
            recommendationType: "improve_product",
            context: "Focus on mobile",
            regenerate: false,
          })
        );
      });
    });

    it("opens regenerate modal when Regenerate is clicked and calls generateRecommendations with regenerate true and no context on confirm", async () => {
      const user = userEvent.setup();
      api.fetchClaudeAnalysis.mockResolvedValue(analysisWithPainPoints);
      api.fetchSavedRecommendations.mockResolvedValue({
        recommendations: [
          {
            product: "hubspot",
            recommendation_type: "improve_product",
            recommendations: [{ title: "R1" }],
            summary: "S",
          },
        ],
      });
      api.generateRecommendations.mockResolvedValue({ status: "success", job_id: "job-2" });

      renderWithRouter("Hubspot");

      await waitFor(() => {
        expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
      });

      await user.click(screen.getByRole("button", { name: /recommendations/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /regenerate/i }));
      await waitFor(() => {
        expect(screen.getByText(/regenerate recommendations\?/i)).toBeInTheDocument();
        expect(screen.getByText(/1 credit/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const confirmBtn = within(dialog).getByRole("button", { name: /^regenerate$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(api.generateRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            products: ["Hubspot"],
            recommendationType: "improve_product",
            regenerate: true,
          })
        );
        const call = api.generateRecommendations.mock.calls[0][0];
        expect(call.context === undefined || call.context === "").toBe(true);
      });
    });

    it("calls generateRecommendations with regenerate true and context when user types in regenerate modal and confirms", async () => {
      const user = userEvent.setup();
      api.fetchClaudeAnalysis.mockResolvedValue(analysisWithPainPoints);
      api.fetchSavedRecommendations.mockResolvedValue({
        recommendations: [
          {
            product: "hubspot",
            recommendation_type: "improve_product",
            recommendations: [{ title: "R1" }],
            summary: "S",
          },
        ],
      });
      api.generateRecommendations.mockResolvedValue({ status: "success", job_id: "job-2" });

      renderWithRouter("Hubspot");

      await waitFor(() => {
        expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
      });

      await user.click(screen.getByRole("button", { name: /recommendations/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /regenerate/i }));
      await waitFor(() => {
        expect(screen.getByLabelText(/optional direction \(max 500 chars\)/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog");
      const textarea = within(dialog).getByLabelText(/optional direction \(max 500 chars\)/i);
      await user.type(textarea, "Prioritize speed");
      const confirmBtn = within(dialog).getByRole("button", { name: /^regenerate$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(api.generateRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            products: ["Hubspot"],
            recommendationType: "improve_product",
            context: "Prioritize speed",
            regenerate: true,
          })
        );
      });
    });
  });

  it("shows different recommendation content per type when switching tabs (fetch by type)", async () => {
    const user = userEvent.setup();
    const docsByType = {
      improve_product: { recommendation_type: "improve_product", summary: "Improve summary", recommendations: [] },
      new_feature: { recommendation_type: "new_feature", summary: "New feature summary", recommendations: [] },
      competing_product: { recommendation_type: "competing_product", summary: "Competing summary", recommendations: [] },
    };
    api.fetchClaudeAnalysis.mockResolvedValue({ analyses: [] });
    api.fetchSavedRecommendations.mockImplementation(({ recommendationType }) =>
      Promise.resolve({ recommendations: [docsByType[recommendationType] || docsByType.improve_product] })
    );

    renderWithRouter("Hubspot");

    await waitFor(() => {
      expect(screen.getByTestId("page-header")).toHaveTextContent("Hubspot");
    });

    await user.click(screen.getByRole("button", { name: /recommendations/i }));
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-page")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("rec-summary")).toHaveTextContent("Improve summary");
    });

    await user.click(screen.getByRole("tab", { name: /create a new feature/i }));
    await waitFor(() => {
      expect(api.fetchSavedRecommendations).toHaveBeenCalledWith(expect.objectContaining({ recommendationType: "new_feature" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("rec-summary")).toHaveTextContent("New feature summary");
    });

    await user.click(screen.getByRole("tab", { name: /create a competing product/i }));
    await waitFor(() => {
      expect(api.fetchSavedRecommendations).toHaveBeenCalledWith(expect.objectContaining({ recommendationType: "competing_product" }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("rec-summary")).toHaveTextContent("Competing summary");
    });
  });
});
